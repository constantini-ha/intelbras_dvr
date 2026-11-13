# Notes for whoever works on this integration

- User-visible text ships in three languages: `translations/{en,pt-BR,es}.json`
  for the config flow and `frontend/i18n.js` for the panel and the card. Release
  notes too.
- The frontend is served under `/intelbras_dvr/frontend/<version>/`, so any change
  to a `.js` file needs a version bump in `manifest.json` or browsers keep the old one.
- The live picture is Home Assistant's own `picture-entity` card, built through
  `window.loadCardHelpers()`. From 2026.11 its stream element reads `hass` from a
  Lit context provided by `<home-assistant>`, not from a property: a card mounted
  outside that tree (a test that appends to `document.body`) throws
  `Cannot read properties of undefined (reading 'callWS')`. Mount tests inside
  `document.querySelector("home-assistant").shadowRoot`.
- A card has a `hass` setter and no getter: use `this._hass`, never `this.hass`.
- The DVR's main stream (`subtype=0`) is H.265 here and WebRTC answers 404 on
  DESCRIBE; the substream (`subtype=1`) is H.264 and plays everywhere, so it is
  the default. Recordings are H.265 too: Safari and Chrome with hardware HEVC
  play them, headless Chromium does not, so a test can only check that the
  playlist resolves.
- `mediaFileFind.cgi` wants `%20`, queries are 1-based and answers 0-based.
- Releases are `gh release create vX.Y.Z`; HACS and the Marketplace only offer
  what has a published release.
