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
- Recordings are a day timeline fed by the `intelbras_dvr/recordings` websocket command
  (seconds since midnight, merged). The DVR only plays from an instant, so every
  tap resolves a new `PLAY|entry|channel|start|end` stream of `WINDOW` seconds;
  there is no seeking inside one.
- To test a card that is already installed, serve the development file under another
  element name, or `customElements.define` throws and the old class answers.
- `ha-hls-player` takes `autoPlay` and `playsInline` (camel case); the lowercase
  `autoplay` is ignored and the video stays black until someone presses play.
  Hand it the **master** playlist: it names the codec, and without it the player
  assumes H.264 and an H.265 recording never shows.
- A recording is served as a live sliding window at 1x: `ended` never fires, so the
  card moves to the next window by the clock.
- The iPhone has no element fullscreen. The fallback puts the card in the top layer
  (`popover="manual"` + `showPopover()`), with safe-area padding; a plain
  `position:fixed` stayed under the app header and hid the way out.
- To test an installed card against the working tree, block service workers and
  `page.route('**/intelbras_dvr/frontend/**')` to the local files.
- `media_source/resolve_media` answers a relative URL and `ha-hls-player` does
  `new URL(child, this.url)` on a master playlist: give it an absolute URL or it
  throws `Invalid base URL`.
- From 0.7.0 the camera view is one channel with a timeline, like the DVR's app:
  a fixed needle in the middle and a strip that scrolls under it (native scroll on
  touch, hand-made drag for the mouse). The moment under the needle is
  `scrollLeft / track width`; 450 ms after the scroll stops and the finger is up,
  `_playAt` starts a stream there. Scrolls the card makes itself are told apart by
  `_autoUntil`.
- The strip's width must not depend on its content: `.timeline` has
  `contain:inline-size` and the padding and track width are set in pixels. With a
  percentage padding on a `max-content` box the card grew to 33 million pixels.
- "Now" is Home Assistant's time zone (`hass.config.time_zone`), not the browser's.
- The panel passes `default_view: "timeline"`; a dashboard card opens on the grid.
