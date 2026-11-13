"""Serves the cameras panel and the dashboard card."""
from __future__ import annotations

from pathlib import Path

from homeassistant.components import panel_custom
from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.loader import async_get_integration

from .const import DOMAIN

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
