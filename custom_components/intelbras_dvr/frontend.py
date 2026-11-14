"""Serves the cameras panel and the dashboard card."""
from __future__ import annotations

from pathlib import Path

from datetime import datetime, time, timedelta

import voluptuous as vol
from homeassistant.components import panel_custom, websocket_api
from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.loader import async_get_integration

from homeassistant.util import dt as dt_util

from .const import CONF_CHANNELS, DEFAULT_CHANNELS, DOMAIN
from .playback import async_setup_playback

CARD_FILE = "intelbras-dvr-card.js"
PANEL_FILE = "intelbras-dvr-panel.js"
PANEL_URL_PATH = "intelbras-dvr"
FRONTEND_URL = f"/{DOMAIN}/frontend"
READY_FLAG = f"{DOMAIN}_frontend"
SIDEBAR_TITLES = {"pt": "Câmeras", "es": "Cámaras"}


async def async_setup_frontend(hass: HomeAssistant) -> None:
    """Register the card and the sidebar panel, once per Home Assistant run."""
    if hass.data.get(READY_FLAG):
        return
    hass.data[READY_FLAG] = True

    integration = await async_get_integration(hass, DOMAIN)
    # Serving under the version keeps a browser from mixing old and new files.
    base = f"{FRONTEND_URL}/{integration.version}"

    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                base, str(Path(__file__).parent / "frontend"), cache_headers=True
            )
        ]
    )
    add_extra_js_url(hass, f"{base}/{CARD_FILE}")

    websocket_api.async_register_command(hass, websocket_recordings)
    async_setup_playback(hass)

    language = (hass.config.language or "en").split("-")[0]
    await panel_custom.async_register_panel(
        hass,
        webcomponent_name="intelbras-dvr-panel",
        frontend_url_path=PANEL_URL_PATH,
        module_url=f"{base}/{PANEL_FILE}",
        sidebar_title=SIDEBAR_TITLES.get(language, "Cameras"),
        sidebar_icon="mdi:cctv",
        require_admin=False,
        embed_iframe=False,
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/recordings",
        vol.Required("channel"): vol.All(int, vol.Range(min=1)),
        vol.Optional("day"): str,
        vol.Optional("entry_id"): str,
    }
)
@websocket_api.async_response
async def websocket_recordings(hass, connection, msg):
    """Say which stretches of one day a channel has on disk, for the timeline."""
    loaded = hass.data.get(DOMAIN, {})
    entries = [
        entry
        for entry in hass.config_entries.async_entries(DOMAIN)
        if entry.entry_id in loaded and "client" in loaded[entry.entry_id]
    ]
    entry = next(
        (e for e in entries if e.entry_id == msg.get("entry_id")),
        entries[0] if entries else None,
    )
    if entry is None:
        connection.send_error(msg["id"], "not_loaded", "DVR not loaded")
        return
    try:
        day = (
            datetime.strptime(msg["day"], "%Y-%m-%d").date()
            if msg.get("day")
            else dt_util.now().date()
        )
    except ValueError:
        connection.send_error(msg["id"], "invalid_day", "day must be YYYY-MM-DD")
        return
    start = datetime.combine(day, time.min)
    end = start + timedelta(days=1)
    try:
        found = await loaded[entry.entry_id]["client"].find_recordings(
            msg["channel"], start, end - timedelta(seconds=1)
        )
    except Exception as err:  # noqa: BLE001
        connection.send_error(msg["id"], "dvr_unavailable", str(err))
        return

    # Seconds since that day's midnight, merged so the bar draws few blocks.
    ranges: list[list[int]] = []
    for rec in sorted(found, key=lambda r: r.start):
        begin = max(0, int((rec.start - start).total_seconds()))
        finish = min(86400, int((rec.end - start).total_seconds()))
        if finish <= begin:
            continue
        if ranges and begin <= ranges[-1][1] + 2:
            ranges[-1][1] = max(ranges[-1][1], finish)
        else:
            ranges.append([begin, finish])
    connection.send_result(
        msg["id"],
        {
            "entry_id": entry.entry_id,
            "day": day.isoformat(),
            "today": dt_util.now().date().isoformat(),
            "channels": entry.options.get(
                CONF_CHANNELS, entry.data.get(CONF_CHANNELS, DEFAULT_CHANNELS)
            ),
            "ranges": ranges,
        },
    )
