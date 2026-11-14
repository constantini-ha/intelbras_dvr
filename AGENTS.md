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
- From 0.8.0 recordings no longer go through Home Assistant's `stream` (RTSP
  playback at 1x, H.265 untouched, which the iPhone refused with "Error with media
  stream contents"). `playback.py` downloads the stretch from
  `/cgi-bin/loadfile.cgi?action=startLoad` (about 25x real time, DAV container),
  pipes it into ffmpeg (`-f dhav`, libx264 ultrafast, 960x540, 2 s segments) and
  serves an HLS event playlist under `/api/intelbras_dvr/playback/<token>/`. An
  N100 converts about 10x real time, which is what makes 8x possible. The older
  notes above about the master playlist, the sliding window and "no seeking" only
  describe the past.
- The conversion waits while it is `LEAD_SEGMENTS` ahead of the last segment the
  player asked for, so a paused or slow player costs no processor.
- The playlist is served with `#EXT-X-START:TIME-OFFSET=0`; without it players open
  an unfinished playlist at its newest end.
- hls.js (inside `ha-hls-player`) treats the unfinished playlist as live and sets
  `playbackRate` back to 1 on every `timeupdate`; the card puts it back on
  `ratechange` and sets `maxLiveSyncPlaybackRate = 1` on the instance.
- Chromium says it plays HLS natively but its native player broke on speed changes
  and on a second load: the plain `<video>` is only for Apple browsers
  (`navigator.vendor`), with one retry through `ha-hls-player`.
- The converted video is H.264, so headless Chromium shows recordings now. The
  server half can run outside Home Assistant with stubbed `homeassistant` modules
  and the card pointed at it by `page.route`; that is how 0.8.0 was tested before
  it was installed.
- The DVR joins recorded stretches in one download, so video time skips the gaps
  the clock has: `_clockOf` and `_offsetOf` translate between the two.
- A touch screen keeps `:hover` on the last button tapped. A hover background must
  not apply to a button in its `.on` state, or it replaces the accent background
  under text coloured for the accent: the speed pill became unreadable at 2x.
- All `:hover` rules of the card and the panel live under `@media (hover:hover)`:
  on a phone the user read the stuck hover as "the button stays pressed until I
  tap something else".
