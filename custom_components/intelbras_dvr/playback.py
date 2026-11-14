"""Recordings as H.264 HLS, converted from the DVR's file download.

The DVR hands a recording over HTTP many times faster than it plays, so the
player can run ahead of the clock, and H.264 plays in every browser.
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
import secrets
import shutil
import tempfile
import time
import urllib.parse
from datetime import datetime, timedelta

import httpx
import voluptuous as vol
from aiohttp import web

from homeassistant.components import websocket_api
from homeassistant.components.http import HomeAssistantView
from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.util import dt as dt_util

from .const import DOMAIN
from .dvr import IntelbrasClient

_LOGGER = logging.getLogger(__name__)

SESSIONS = f"{DOMAIN}_playback"
URL_BASE = f"/api/{DOMAIN}/playback"
PLAYLIST = "index.m3u8"
SEGMENT_SECONDS = 2
# Segments kept ready ahead of the player; beyond that the conversion waits.
LEAD_SEGMENTS = 30
IDLE_SECONDS = 300
MAX_SESSIONS = 3
START_TIMEOUT = 25
MAX_WINDOW = 3600
_LOAD_FMT = "%Y-%m-%d %H:%M:%S"
_FILE_RE = re.compile(r"^(index\.m3u8|s(\d{5})\.ts)$")
# 1080N recordings are half as wide as they should be, so those go out as 960x540.
_SCALE = "scale=960:'if(gt(ih,iw),540,trunc(ih*960/iw/2)*2)'"


class PlaybackError(Exception):
    """The recording could not be started."""


def _ffmpeg(hass: HomeAssistant) -> str:
    try:
        from homeassistant.components.ffmpeg import get_ffmpeg_manager

        return get_ffmpeg_manager(hass).binary
    except Exception:  # noqa: BLE001
        return "ffmpeg"


class Playback:
    """One recording being converted for one player."""

    def __init__(
        self,
        hass: HomeAssistant,
        client: IntelbrasClient,
        channel: int,
        start: datetime,
        end: datetime,
    ) -> None:
        self.hass = hass
        self.client = client
        self.channel = channel
        self.start = start
        self.end = end
        self.token = secrets.token_urlsafe(24)
        self.folder: str | None = None
        self.wanted = -1
        self.seen = time.monotonic()
        self.error: str | None = None
        self._proc: asyncio.subprocess.Process | None = None
        self._task: asyncio.Task | None = None
        self._checked = 0.0
        self._made = 0
        self._closed = False

    @property
    def url(self) -> str:
        return f"{URL_BASE}/{self.token}/{PLAYLIST}"

    async def async_start(self) -> None:
        self.folder = await self.hass.async_add_executor_job(
            tempfile.mkdtemp, None, f"{DOMAIN}_"
        )
        self._proc = await asyncio.create_subprocess_exec(
            _ffmpeg(self.hass),
            "-hide_banner", "-loglevel", "error", "-nostdin",
            "-f", "dhav", "-i", "pipe:0",
            "-an", "-vf", _SCALE,
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "26",
            "-pix_fmt", "yuv420p", "-sc_threshold", "0",
            "-force_key_frames", f"expr:gte(t,n_forced*{SEGMENT_SECONDS})",
            "-f", "hls", "-hls_time", str(SEGMENT_SECONDS), "-hls_list_size", "0",
            "-hls_playlist_type", "event",
            "-hls_segment_filename", os.path.join(self.folder, "s%05d.ts"),
            os.path.join(self.folder, PLAYLIST),
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        self._task = self.hass.async_create_background_task(
            self._feed(), f"{DOMAIN} playback {self.token[:6]}"
        )
        playlist = os.path.join(self.folder, PLAYLIST)
        deadline = time.monotonic() + START_TIMEOUT
        while time.monotonic() < deadline:
            if await self.hass.async_add_executor_job(os.path.exists, playlist):
                return
            if self._task.done():
                break
            await asyncio.sleep(0.2)
        # A short stretch only gets its playlist when the conversion ends.
        if await self.hass.async_add_executor_job(os.path.exists, playlist):
            return
        error = self.error or "the DVR sent no video"
        await self.async_close()
        raise PlaybackError(error)

    def _source(self) -> str:
        def quote(moment: datetime) -> str:
            return urllib.parse.quote(moment.strftime(_LOAD_FMT), safe=":")

        return (
            f"{self.client.base}/cgi-bin/loadfile.cgi?action=startLoad"
            f"&channel={self.channel}"
            f"&startTime={quote(self.start)}&endTime={quote(self.end)}"
        )

    async def _ahead(self) -> int:
        now = time.monotonic()
        if now - self._checked > 0.3:
            self._checked = now
            names = await self.hass.async_add_executor_job(os.listdir, self.folder)
            self._made = sum(1 for name in names if name.endswith(".ts"))
        return self._made - 1 - self.wanted

    async def _feed(self) -> None:
        proc = self._proc
        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(30.0, read=120.0),
                auth=httpx.DigestAuth(self.client.username, self.client.password),
                verify=False,
            ) as cli:
                async with cli.stream("GET", self._source()) as resp:
                    if resp.status_code != 200:
                        self.error = f"DVR answered HTTP {resp.status_code}"
                        return
                    async for chunk in resp.aiter_bytes(65536):
                        proc.stdin.write(chunk)
                        await proc.stdin.drain()
                        while await self._ahead() > LEAD_SEGMENTS:
                            await asyncio.sleep(0.4)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except httpx.HTTPError as err:
            self.error = f"DVR download failed: {err}"
        finally:
            try:
                proc.stdin.close()
            except Exception:  # noqa: BLE001
                pass
            try:
                tail = await asyncio.wait_for(proc.stderr.read(), 30)
                await asyncio.wait_for(proc.wait(), 30)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                tail = b""
            if proc.returncode not in (0, None) and not self.error and not self._closed:
                self.error = tail.decode(errors="replace").strip()[-300:] or (
                    f"ffmpeg exited with {proc.returncode}"
                )
            if self.error:
                _LOGGER.warning("Recording playback failed: %s", self.error)

    async def async_close(self) -> None:
        self._closed = True
        if self._task and not self._task.done():
            self._task.cancel()
        if self._proc and self._proc.returncode is None:
            try:
                self._proc.kill()
            except ProcessLookupError:
                pass
        if self.folder:
            await self.hass.async_add_executor_job(shutil.rmtree, self.folder, True)


def _sessions(hass: HomeAssistant) -> dict[str, Playback]:
    return hass.data.setdefault(SESSIONS, {})


async def async_close_session(hass: HomeAssistant, token: str | None) -> None:
    session = _sessions(hass).pop(token, None) if token else None
    if session:
        await session.async_close()


async def async_open_session(
    hass: HomeAssistant,
    client: IntelbrasClient,
    channel: int,
    start: datetime,
    end: datetime,
) -> Playback:
    """Start converting one stretch; `start` and `end` are the DVR's local time."""
    now = dt_util.now().replace(tzinfo=None)
    end = min(end, start + timedelta(seconds=MAX_WINDOW), now)
    if end <= start:
        raise PlaybackError("nothing recorded there yet")
    sessions = _sessions(hass)
    while len(sessions) >= MAX_SESSIONS:
        oldest = min(sessions.values(), key=lambda item: item.seen)
        await async_close_session(hass, oldest.token)
    session = Playback(hass, client, channel, start, end)
    await session.async_start()
    sessions[session.token] = session
    return session


class PlaybackView(HomeAssistantView):
    """Serves the playlist and the segments; the random token is the key."""

    url = URL_BASE + "/{token}/{name}"
    name = f"api:{DOMAIN}:playback"
    requires_auth = False

    async def get(self, request: web.Request, token: str, name: str) -> web.StreamResponse:
        hass = request.app["hass"]
        session = _sessions(hass).get(token)
        match = _FILE_RE.match(name)
        if session is None or match is None or not session.folder:
            raise web.HTTPNotFound
        session.seen = time.monotonic()
        path = os.path.join(session.folder, name)
        if name == PLAYLIST:
            try:
                text = await hass.async_add_executor_job(_read_text, path)
            except OSError as err:
                raise web.HTTPNotFound from err
            # Without this, players open an unfinished playlist at its newest end.
            text = text.replace(
                "#EXTM3U", "#EXTM3U\n#EXT-X-START:TIME-OFFSET=0,PRECISE=YES", 1
            )
            return web.Response(
                text=text,
                content_type="application/vnd.apple.mpegurl",
                headers={"Cache-Control": "no-cache"},
            )
        session.wanted = max(session.wanted, int(match.group(2)))
        if not await hass.async_add_executor_job(os.path.exists, path):
            raise web.HTTPNotFound
        return web.FileResponse(path, headers={"Content-Type": "video/mp2t"})


def _read_text(path: str) -> str:
    with open(path, encoding="utf-8") as handle:
        return handle.read()


def _entry_client(hass: HomeAssistant, entry_id: str | None):
    loaded = hass.data.get(DOMAIN, {})
    for entry in hass.config_entries.async_entries(DOMAIN):
        data = loaded.get(entry.entry_id)
        if data and "client" in data and entry_id in (None, entry.entry_id):
            return data["client"]
    return None


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/playback/start",
        vol.Required("channel"): vol.All(int, vol.Range(min=1)),
        vol.Required("day"): str,
        vol.Required("second"): vol.All(int, vol.Range(min=0, max=86399)),
        vol.Optional("length", default=1800): vol.All(int, vol.Range(min=10, max=MAX_WINDOW)),
        vol.Optional("entry_id"): str,
        vol.Optional("replaces"): str,
    }
)
@websocket_api.async_response
async def websocket_start(hass, connection, msg):
    """Start a recording at one second of one day and say where to play it."""
    await async_close_session(hass, msg.get("replaces"))
    client = _entry_client(hass, msg.get("entry_id"))
    if client is None:
        connection.send_error(msg["id"], "not_loaded", "DVR not loaded")
        return
    try:
        day = datetime.strptime(msg["day"], "%Y-%m-%d")
    except ValueError:
        connection.send_error(msg["id"], "invalid_day", "day must be YYYY-MM-DD")
        return
    start = day + timedelta(seconds=msg["second"])
    try:
        session = await async_open_session(
            hass, client, msg["channel"], start, start + timedelta(seconds=msg["length"])
        )
    except PlaybackError as err:
        connection.send_error(msg["id"], "playback_failed", str(err))
        return
    connection.send_result(msg["id"], {"url": session.url, "token": session.token})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/playback/stop",
        vol.Required("token"): str,
    }
)
@websocket_api.async_response
async def websocket_stop(hass, connection, msg):
    await async_close_session(hass, msg["token"])
    connection.send_result(msg["id"])


@callback
def async_setup_playback(hass: HomeAssistant) -> None:
    """Register the view, the commands and the sweep of forgotten sessions."""
    hass.http.register_view(PlaybackView)
    websocket_api.async_register_command(hass, websocket_start)
    websocket_api.async_register_command(hass, websocket_stop)

    async def sweep(_now=None) -> None:
        limit = time.monotonic() - IDLE_SECONDS
        for token, session in list(_sessions(hass).items()):
            if session.seen < limit:
                await async_close_session(hass, token)

    async def close_all(_event) -> None:
        for token in list(_sessions(hass)):
            await async_close_session(hass, token)

    async_track_time_interval(hass, sweep, timedelta(seconds=60))
    hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, close_all)
