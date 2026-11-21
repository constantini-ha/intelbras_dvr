import { t, tn } from "./i18n.js";

const PLATFORM = "intelbras_dvr";
// How much video one request to the DVR covers, in seconds.
const WINDOW = 1800;
const RATES = [1, 2, 4, 8];
// Four conversions at 4x take the whole N100; at 2x they use about half of it.
const RATES_ALL = [1, 2];
const SMALL_WIDTH = 640;
// A paused recording is dropped by the server after a while; past this it is asked for again.
const PAUSE_LIMIT = 240000;
const DAY = 86400;
const LIVE_CHECK = 700;
// A live picture with no frame by then counts as failed; a failed one is rebuilt after RETRY.
const STALL = 45000;
const RETRY = 30000;
const LOADING_LOGO = "/static/images/home-assistant-logo-loading.svg";
// That logo held still and in red; the instance only serves the animated one.
const FAILED_LOGO = `<svg viewBox="0 0 120 120" aria-hidden="true">
  <g transform="matrix(1.5 0 0 1.5 -45 -14.45)">
    <path class="house" d="M73.5367 13.0937 106.463 46.0524v.0033C108.41 48.0043 110 51.848 110 54.6007v30.0292c0 2.7527-2.25 5.0049-5 5.0049l-70-.0034c-2.75 0-5-2.2522-5-5.0048V54.5974c0-2.7527 1.5933-6.5998 3.5367-8.545l32.93-32.9587c1.9433-1.9452 5.1266-1.9452 7.07 0Z"/>
    <path class="mark" d="m70 89.6348-20-20M70 89.6348v-52M90 58.1348l-20 20"/>
    <circle class="dot" r="7" cx="50" cy="69.6348"/>
    <circle class="dot" r="7" cx="90" cy="58.6348"/>
    <circle class="dot" r="7" cx="70" cy="37.6348"/>
  </g>
</svg>`;
// How much of the day fits across the timeline, and the gap between its labels.
const SPANS = [
  { seconds: 600, label: "10 min", step: 120 },
  { seconds: 3600, label: "1 h", step: 600 },
  { seconds: 21600, label: "6 h", step: 3600 },
  { seconds: 86400, label: "24 h", step: 14400 },
];

const STYLE = `
  :host { display:block }
  [hidden] { display:none !important }
  ha-card { overflow:hidden; display:flex; flex-direction:column; container-type:inline-size }
  :host(.full) { position:fixed; inset:0; z-index:9999; width:100%; height:100%; max-width:none;
    max-height:none; margin:0; border:0; overflow:hidden; box-sizing:border-box; background:#000;
    padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom)
      env(safe-area-inset-left) }
  :host(.full) ha-card, :host(:fullscreen) ha-card { height:100%; border-radius:0; border:0; background:#000 }
  .bar { display:flex; align-items:center; gap:4px; padding:6px 8px 6px 14px; min-height:44px }
  .bar .title { flex:1; min-width:0; font-size:16px; font-weight:500; white-space:nowrap;
    overflow:hidden; text-overflow:ellipsis; color:var(--primary-text-color) }
  :host(.full) .bar .title, :host(:fullscreen) .bar .title { color:#fff }
  button { all:unset; box-sizing:border-box; cursor:pointer; display:inline-flex; align-items:center;
    justify-content:center; gap:6px; -webkit-tap-highlight-color:transparent; --mdc-icon-size:20px }
  button:focus-visible { outline:2px solid var(--primary-color); outline-offset:1px }
  button:not([disabled]):active { opacity:.6 }
  button[disabled] { opacity:.35; cursor:default }
  .bar button { min-height:36px; padding:0 10px; border-radius:18px; font-size:13px;
    color:var(--secondary-text-color) }
  .bar button.on { color:var(--primary-color);
    background:color-mix(in srgb, var(--primary-color) 14%, transparent) }
  .bar button.icon { padding:0 8px }
  :host(.full) .bar button:not(.on), :host(:fullscreen) .bar button:not(.on) { color:#fff }
  @container (max-width: 369px) { .bar button span { display:none } .bar button { padding:0 8px } }
  /* The pictures never get taller than the window: on a wide screen they stop growing. */
  .wrap { background:#000; flex:1; min-height:0; display:flex; flex-direction:column;
    justify-content:center }
  /* Fixed 3:2 cells and a plain max-width: Safari left black bands under the pictures. */
  .grid { display:grid; gap:3px; background:#000; box-sizing:border-box; margin:0 auto; width:100%;
    max-width:calc(max(200px, 100vh - var(--chrome, 150px)) * var(--aspect, 1.5) * var(--ratio, 1)) }
  .cell { position:relative; background:#000; overflow:hidden; min-width:0; aspect-ratio:3/2 }
  .stream { position:relative; container-type:inline-size }
  .cell > .stream, .player.live > .stream { position:absolute; inset:0; display:flex;
    flex-direction:column; justify-content:center }
  .stream > * { display:block; --ha-card-border-radius:0; --ha-card-border-width:0;
    --ha-card-box-shadow:none; --ha-card-background:#000 }
  .grid > [role=button] { cursor:pointer }
  .grid > [role=button]:focus-visible { outline:2px solid var(--primary-color); outline-offset:-2px }
  .grid .name { position:absolute; right:8px; bottom:8px; padding:2px 8px; border-radius:10px;
    background:rgba(0,0,0,.55); color:#fff; font-size:12px; pointer-events:none }
  :host(.full) .grid, :host(:fullscreen) .grid { align-content:center }
  :host(.full) .wrap, :host(:fullscreen) .wrap { container-type:size; overflow:hidden }
  :host(.full) .grid, :host(:fullscreen) .grid { max-width:calc(100cqh * var(--aspect, 1.5) * var(--ratio, 1)) }
  .empty { padding:24px 16px; color:var(--secondary-text-color); text-align:center }

  .body { display:flex; flex-direction:column; min-height:0; flex:1 }
  .rec { background:var(--card-background-color); color:var(--primary-text-color) }
  /* Recordings are 16:9; the live substream is 3:2 and gets side bars here. */
  .rec .grid { --chrome:430px; --aspect:1.7778 }
  .rec.single .grid { --chrome:470px }
  .rec .grid.live { --aspect:1.5 }
  /* Wide: the date and the transport share one row and the time sits on the timeline. */
  @container (min-width: 700px) {
    .rec { display:grid; grid-template-columns:auto minmax(0, 1fr);
      grid-template-rows:minmax(0, 1fr) auto auto auto;
      grid-template-areas:"top top" "chips chips" "line line" "nav ctl" }
    .rec > .wrap { grid-area:top; justify-self:stretch }
    .rec > .chips { grid-area:chips }
    .rec > .timeline { grid-area:line }
    .rec > .now { grid-area:line; align-self:start; justify-self:center; position:relative; z-index:1;
      margin-top:3px; padding:0 10px; border-radius:10px; background:var(--secondary-background-color);
      pointer-events:none }
    .rec > .nav { grid-area:nav; padding:10px 4px 14px 12px }
    .rec > .nav .gap { flex:0 0 4px }
    .rec > .transport { grid-area:ctl }
    .rec .grid { --chrome:345px }
    .rec.single .grid { --chrome:380px }
  }
  .player { position:relative; background:#000; aspect-ratio:16/9; overflow:hidden; min-width:0 }
  .player > .video { position:absolute; inset:0; display:block; width:100%; height:100% }
  .rec .grid.live > .player { aspect-ratio:3/2 }
  /* One picture fills the grid; the others keep playing under it, so going back costs nothing. */
  .grid.solo { grid-template-columns:minmax(0, 1fr) !important; --ratio:1 !important; position:relative }
  .grid.solo > :not([data-picked]) { position:absolute; inset:0; z-index:0 }
  .grid.solo > [data-picked] { z-index:1 }
  .hint { position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
    padding:16px; text-align:center; color:rgba(255,255,255,.78); font-size:14px }
  .player { container-type:inline-size }
  .hint.busy { flex-direction:column; gap:10px; background:#000; font-size:13px;
    animation:busy-in .25s ease-out both }
  .hint.busy img { width:64px; height:64px }
  .hint.fail { flex-direction:column; gap:10px; background:#000; font-size:13px; line-height:1.3;
    animation:busy-in .25s ease-out both }
  .hint.fail svg { width:60px; height:60px; overflow:visible }
  .hint.fail .house { fill:var(--error-color, #db4437) }
  .hint.fail .mark { fill:none; stroke:#f2f4f9; stroke-width:6; stroke-linecap:round }
  .hint.fail .dot { fill:#f2f4f9 }
  .hint.fail strong { margin-top:2px; font-weight:500; color:rgba(255,255,255,.9) }
  .hint.fail span { margin-top:-6px; font-size:12px; color:rgba(255,255,255,.6) }
  /* Room for the camera name in the corner. */
  .cell .hint.fail, .player .hint.fail { padding-bottom:30px }
  @keyframes busy-in { from { opacity:0 } }
  @container (max-width: 260px) { .hint.busy img { width:44px; height:44px } .hint.busy span { display:none }
    .hint.fail { gap:6px; font-size:12px } .hint.fail span { margin-top:-4px }
    .hint.fail svg { width:40px; height:40px } }
  @container (max-width: 200px) { .hint.fail span { display:none } .hint.fail svg { width:34px; height:34px } }
  .badge { position:absolute; left:8px; top:8px; display:flex; align-items:center; gap:6px;
    padding:3px 9px; border-radius:10px; background:rgba(0,0,0,.55); color:#fff; font-size:12px;
    pointer-events:none }
  .badge::before { content:""; width:7px; height:7px; border-radius:50%; background:#ff4d4d }
  .chips { display:flex; gap:6px; padding:10px 12px 0; overflow-x:auto; scrollbar-width:none }
  .chips::-webkit-scrollbar { display:none }
  .pill { flex:none; min-height:36px; padding:0 14px; border-radius:18px; font-size:13px;
    white-space:nowrap; border:1px solid var(--outline-color, var(--divider-color)) }
  .pill.on { border-color:transparent; background:var(--primary-color); color:var(--text-primary-color) }
  .nav { display:flex; align-items:center; gap:6px; padding:10px 12px 0 }
  .nav input { box-sizing:border-box; flex:1; min-width:0; max-width:190px; font:inherit; font-size:14px;
    min-height:36px; padding:0 10px; border-radius:18px;
    border:1px solid var(--outline-color, var(--divider-color)); background:transparent;
    color:var(--primary-text-color); color-scheme:light dark }
  .nav input:focus-visible { outline:2px solid var(--primary-color); outline-offset:1px }
  .round { flex:none; width:36px; height:36px; border-radius:50% }
  .nav .gap { flex:1 }
  .now { padding:10px 12px 2px; text-align:center; font-size:15px; font-weight:500;
    font-variant-numeric:tabular-nums; color:var(--secondary-text-color) }
  .timeline { position:relative; margin:0 0 2px; overflow:hidden; contain:inline-size;
    background:var(--secondary-background-color) }
  .scroll { overflow-x:auto; overflow-y:hidden; scrollbar-width:none; cursor:grab;
    touch-action:pan-x; -webkit-overflow-scrolling:touch; overscroll-behavior-x:contain }
  .scroll::-webkit-scrollbar { display:none }
  .scroll.drag { cursor:grabbing }
  .pad { width:max-content }
  .track { position:relative; height:108px }
  .block { position:absolute; top:26px; height:40px; min-width:2px; border-radius:20px;
    background:var(--primary-color); opacity:.9 }
  .tick { position:absolute; bottom:0; height:30px; padding:0 0 4px 5px; display:flex;
    align-items:flex-end; font-size:11px; font-variant-numeric:tabular-nums; white-space:nowrap;
    color:var(--secondary-text-color); border-left:1px solid var(--divider-color) }
  .needle { position:absolute; top:0; bottom:0; left:50%; width:2px; margin-left:-1px;
    background:var(--primary-text-color); opacity:.55; pointer-events:none }
  .needle::after { content:""; position:absolute; left:-4px; bottom:0; border:5px solid transparent;
    border-bottom-color:var(--primary-text-color) }
  .transport { display:flex; align-items:center; gap:10px; padding:10px 12px 14px }
  .transport .side { flex:1; display:flex; align-items:center }
  .transport .side.end { justify-content:flex-end }
  .transport .round { width:44px; height:44px; --mdc-icon-size:24px }
  .transport .main { width:56px; height:56px; border:2px solid var(--primary-text-color);
    --mdc-icon-size:30px }
  .golive.on { border-color:transparent;
    background:color-mix(in srgb, var(--primary-color) 16%, transparent); color:var(--primary-color) }
  .golive::before { content:""; width:7px; height:7px; border-radius:50%; background:currentColor;
    opacity:.6 }
  .golive.on::before { background:#ff4d4d; opacity:1 }
  /* Only where a pointer can hover: a touch screen keeps :hover on the last button tapped. */
  @media (hover:hover) {
    .bar button:not(.on):hover { background:var(--secondary-background-color) }
    :host(.full) .bar button:hover, :host(:fullscreen) .bar button:hover { background:rgba(255,255,255,.16) }
    .pill:not([disabled]):not(.on):hover { background:var(--secondary-background-color) }
    .round:not([disabled]):hover { background:var(--secondary-background-color) }
  }
`;

const pad = (n) => String(n).padStart(2, "0");

function clock(second, seconds = true) {
  const s = Math.max(0, Math.min(DAY - 1, Math.floor(second)));
  const text = `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}`;
  return seconds ? `${text}:${pad(s % 60)}` : text;
}

class IntelbrasDvrCard extends HTMLElement {
  static getStubConfig() {
    return { columns: 2 };
  }

  static getConfigForm() {
    return {
      schema: [
        { name: "title", selector: { text: {} } },
        { name: "columns", selector: { number: { min: 1, max: 4, mode: "box" } } },
        { name: "entities", selector: { entity: { multiple: true, filter: { domain: "camera" } } } },
      ],
      computeLabel: (field) => tn(`field_${field.name}`),
    };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._view = null;
    this._streams = [];
    this._rec = { channel: 1, day: null, ranges: null, span: 3600, at: null, cursor: null, rate: 1 };
    // The grid with its timeline open: the other channels follow the one in `_rec`.
    this._all = false;
    this._others = [];
    this._lives = new Set();
    // One cell per camera, never moved or rebuilt: the views only rearrange them.
    this._cells = new Map();
    // The channel shown alone over the grid, and whether that tap is what opened full screen.
    this._solo = null;
    this._soloFull = false;
  }

  setConfig(config) {
    this._config = { columns: 2, ...config };
    if (!this._view) this._view = this._config.default_view === "timeline" ? "rec" : "live";
    if (this._hass) this._start();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) {
      this._start();
      return;
    }
    for (const live of this._lives) if (live.card) live.card.hass = hass;
    if (this._player && "hass" in this._player) this._player.hass = hass;
    for (const other of this._others) if (other.player && "hass" in other.player) other.player.hass = hass;
    // A camera that shows up later (the DVR loaded after the page) joins the grid.
    if (this._view === "live" && this._cameras().join() !== this._shown) this._render();
  }

  _start() {
    if (this._view === "rec") this._loadDay();
    else this._render();
  }

  connectedCallback() {
    this._onFull = () => this._syncFullButton();
    document.addEventListener("fullscreenchange", this._onFull);
    this._onKey = (ev) => {
      if (ev.key === "Escape" && this.classList.contains("full")) this._toggleFull();
    };
    document.addEventListener("keydown", this._onKey);
    if (this._hass && this._view === "rec" && !this._tick) this._startTick();
    if (this._lives.size && !this._liveTick) this._startLiveCheck();
  }

  disconnectedCallback() {
    document.removeEventListener("fullscreenchange", this._onFull);
    document.removeEventListener("keydown", this._onKey);
    clearInterval(this._tick);
    this._tick = null;
    clearInterval(this._liveTick);
    this._liveTick = null;
  }

  getCardSize() {
    return 6;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  _t(key, vars) {
    return t(this._hass, key, vars);
  }

  _cameras() {
    if (this._config.entities && this._config.entities.length) return this._config.entities;
    const registry = this._hass.entities || {};
    return Object.keys(registry)
      .filter(
        (id) =>
          id.startsWith("camera.") &&
          registry[id].platform === PLATFORM &&
          !registry[id].hidden &&
          (!this._config.device_id || registry[id].device_id === this._config.device_id)
      )
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  _name(entityId) {
    const registry = (this._hass.entities || {})[entityId];
    // The DVR names its channels in one language; a name the user gave is kept.
    const stock = registry && registry.platform === PLATFORM &&
      /^(DVR Canal )?(\d+)$/.exec(registry.name || (/(\d+)$/.exec(entityId) || [])[1] || "");
    if (stock) return this._t("channel", { n: stock[2] });
    const state = this._hass.states[entityId];
    return (state && state.attributes.friendly_name) || entityId;
  }

  // Inside Home Assistant's shadow roots `document.fullscreenElement` is <home-assistant>.
  _ownsFullscreen() {
    const root = this.getRootNode();
    return (root.fullscreenElement || document.fullscreenElement) === this;
  }

  _isFull() {
    return this.classList.contains("full") || this._ownsFullscreen();
  }

  async _toggleFull() {
    if (this._isFull()) {
      if (this._ownsFullscreen()) await document.exitFullscreen();
      this._cover(false);
    } else if (this.requestFullscreen) {
      await this.requestFullscreen().catch(() => this._cover(true));
    } else {
      this._cover(true);
    }
    this._syncFullButton();
  }

  // The iPhone has no element fullscreen: the card covers the window from the top layer,
  // above the app header, so its own bar (and the way out) stays reachable.
  _cover(on) {
    if (this.hasAttribute("popover")) {
      try { this.hidePopover(); } catch (_) { /* already closed */ }
      this.removeAttribute("popover");
    }
    this.classList.toggle("full", on);
    if (on && this.showPopover) {
      this.setAttribute("popover", "manual");
      try { this.showPopover(); } catch (_) { this.removeAttribute("popover"); }
    }
  }

  _syncFullButton() {
    const button = this.shadowRoot.querySelector("button.fullbtn");
    if (!button) return;
    const full = this._isFull();
    button.title = this._t(full ? "exit_fullscreen" : "fullscreen");
    button.setAttribute("aria-label", button.title);
    button.querySelector("ha-icon").setAttribute(
      "icon", full ? "mdi:fullscreen-exit" : "mdi:fullscreen");
    if (!full && this._solo != null) {
      this._solo = null;
      this._soloFull = false;
      this._applySolo();
    }
  }

  // A tapped picture takes the whole screen; tapped again, the grid (and the screen) come back.
  _pick(channel) {
    this._solo = channel;
    if (channel != null && !this._isFull()) {
      this._soloFull = true;
      this._toggleFull();
    } else if (channel == null && this._soloFull) {
      this._soloFull = false;
      if (this._isFull()) this._toggleFull();
    }
    this._applySolo();
  }

  _applySolo() {
    const root = this.shadowRoot;
    const grid = this._grid;
    const cells = grid ? [...grid.children] : [];
    const picked = cells.find((cell) => !cell.hidden && Number(cell.dataset.channel) === this._solo);
    const solo = picked ? this._solo : null;
    if (grid) grid.classList.toggle("solo", solo != null);
    for (const cell of cells) cell.toggleAttribute("data-picked", cell === picked);
    const mosaic = root.querySelector("button.mosaicbtn");
    const camera = root.querySelector("button.camerabtn");
    const onGrid = this._view === "live" || this._all;
    if (mosaic) mosaic.classList.toggle("on", onGrid && solo == null);
    if (camera) camera.classList.toggle("on", !onGrid || solo != null);
  }

  _button(icon, label, onClick, { on = false, text = true, cls = "" } = {}) {
    const button = document.createElement("button");
    button.className = `${on ? "on" : ""} ${text ? "" : "icon"} ${cls}`.trim();
    button.title = label;
    button.setAttribute("aria-label", label);
    button.innerHTML = `${icon ? `<ha-icon icon="${icon}"></ha-icon>` : ""}${text ? "<span></span>" : ""}`;
    if (text) button.querySelector("span").textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  _skeleton() {
    if (this._body) return;
    const style = document.createElement("style");
    style.textContent = STYLE;
    this._card = document.createElement("ha-card");
    this._body = document.createElement("div");
    this._wrap = document.createElement("div");
    this._wrap.className = "wrap";
    this._grid = document.createElement("div");
    this._grid.className = "grid";
    this._wrap.append(this._grid);
    this._body.append(this._wrap);
    this._card.append(this._body);
    this.shadowRoot.replaceChildren(style, this._card);
  }

  _render() {
    this._skeleton();
    this._player = null;
    this._parts = null;
    const card = this._card;
    const bar = document.createElement("div");
    bar.className = "bar";
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = this._config.title || this._t("cameras");
    const mosaic = this._view === "live" || this._all;
    bar.append(
      title,
      this._button("mdi:view-grid-outline", this._t("mosaic"),
        () => (this._solo != null ? this._pick(null) : this._show("live")),
        { on: mosaic, cls: "mosaicbtn" }),
      this._button("mdi:cctv", this._t("camera"), () => this._show("rec", this._solo || undefined),
        { on: !mosaic, cls: "camerabtn" })
    );
    if (mosaic) {
      bar.append(this._button("mdi:history", this._t("recordings"),
        () => this._show(this._all ? "live" : "all"), { on: this._all, text: false }));
    }
    bar.append(this._button("mdi:fullscreen", this._t("fullscreen"), () => this._toggleFull(),
      { text: false, cls: "fullbtn" }));
    if (this._bar) this._bar.replaceWith(bar);
    else card.prepend(bar);
    this._bar = bar;
    this._syncFullButton();

    const body = this._body;
    for (const node of [...body.children]) if (node !== this._wrap) node.remove();
    body.className = this._view === "live" ? "body" : `body rec${this._all ? "" : " single"}`;
    this._wrap.hidden = false;
    if (this._view === "live") this._renderLive(body);
    else this._renderTimeline(body);
    this._applySolo();
  }

  _show(target, channel) {
    const all = target === "all";
    const view = all ? "rec" : target;
    if (view === this._view && all === this._all && !channel) return;
    this._view = view;
    this._all = all;
    // The camera view is a screen of its own: what the tap opened stays open.
    if (view === "rec" && !all) {
      this._solo = null;
      this._soloFull = false;
    }
    if (view === "rec") {
      const first = all ? this._allChannels()[0] : channel;
      if (all && !RATES_ALL.includes(this._rec.rate)) this._rec.rate = 1;
      this._loadDay({ day: null, ...(first ? { channel: first } : {}) });
      return;
    }
    this._stop();
    this._others = [];
    clearInterval(this._tick);
    this._tick = null;
    this._render();
  }

  _liveCard(helpers, entityId) {
    // Home Assistant's own picture card carries the live stream, HLS or WebRTC.
    const live = helpers.createCardElement({
      type: "picture-entity",
      entity: entityId,
      camera_view: "live",
      show_name: false,
      show_state: false,
      tap_action: { action: "none" },
      hold_action: { action: "none" },
    });
    live.hass = this._hass;
    return live;
  }

  _ownCameras() {
    const registry = this._hass.entities || {};
    return Object.keys(registry)
      .filter((id) => id.startsWith("camera.") && registry[id].platform === PLATFORM &&
        !registry[id].hidden)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  _channelCamera(channel) {
    const own = this._ownCameras();
    return own.find((id) => new RegExp(`\\D${channel}$`).test(id)) || own[channel - 1] || null;
  }

  _cameraChannel(entityId) {
    const own = this._ownCameras();
    const tail = /\D(\d+)$/.exec(entityId);
    if (own.includes(entityId) && tail) return Number(tail[1]);
    return own.indexOf(entityId) + 1 || 1;
  }

  _allChannels() {
    return [...new Set(this._cameras().map((id) => this._cameraChannel(id)))];
  }

  _label(channel) {
    const camera = this._channelCamera(channel);
    return camera ? this._name(camera) : this._t("channel", { n: channel });
  }

  _cell(entityId, channel) {
    const key = entityId || `ch:${channel}`;
    let cell = this._cells.get(key);
    if (!cell) {
      const el = document.createElement("div");
      const badge = document.createElement("div");
      badge.className = "badge";
      badge.hidden = true;
      const tag = document.createElement("div");
      tag.className = "name";
      el.append(badge, tag);
      cell = { key, entity: entityId, channel, el, badge, tag, live: null, layer: [], shown: null };
      const tap = () => {
        if (this._view === "rec" && !this._all) return;
        this._pick(this._solo === cell.channel ? null : cell.channel);
      };
      el.addEventListener("click", tap);
      el.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        ev.preventDefault();
        tap();
      });
      this._grid.append(el);
      this._cells.set(key, cell);
    }
    cell.channel = channel;
    cell.el.dataset.channel = channel;
    return cell;
  }

  // The cells of this view, in its order; the rest stay hidden and keep what they were playing.
  _layout(used) {
    const count = Math.max(1, used.length);
    const columns = Math.max(1, Math.min(Number(this._config.columns) || 2, count));
    this._grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
    this._grid.style.setProperty("--ratio", columns / Math.ceil(count / columns));
    const single = this._view === "rec" && !this._all;
    used.forEach((cell, index) => {
      cell.el.hidden = false;
      cell.el.style.order = index;
      if (single) {
        cell.el.removeAttribute("role");
        cell.el.removeAttribute("tabindex");
        cell.el.removeAttribute("aria-label");
      } else {
        cell.el.setAttribute("role", "button");
        cell.el.tabIndex = 0;
        cell.el.setAttribute("aria-label", cell.tag.textContent);
      }
    });
    const known = new Set([...this._cameras(), ...this._ownCameras()]);
    for (const cell of this._cells.values()) {
      if (used.includes(cell)) continue;
      cell.el.hidden = true;
      // A recording left behind has lost its session; only a live picture is worth keeping.
      if (cell.layer.length) this._paint(cell, null);
      if (cell.entity && known.has(cell.entity)) continue;
      this._paint(cell, null);
      cell.el.remove();
      this._cells.delete(cell.key);
    }
  }

  // Shows the camera live, reusing the picture already there, or the given nodes over nothing.
  _paint(cell, camera, nodes = [], shown = null) {
    if (cell.live && cell.live.entity !== camera) {
      cell.live.holder.remove();
      this._lives.delete(cell.live);
      cell.live = null;
    }
    if (camera && !cell.live) {
      cell.live = this._newLive(camera);
      cell.el.prepend(cell.live.holder);
    }
    for (const node of cell.layer) node.remove();
    cell.layer = nodes;
    cell.badge.before(...nodes);
    cell.shown = shown;
  }

  // A live picture covered by the loader until its first frame, and by the reason when it fails.
  _newLive(entityId) {
    const holder = document.createElement("div");
    holder.className = "stream";
    const live = { entity: entityId, holder, card: null, veil: null, shown: null };
    this._lives.add(live);
    this._mountLive(live);
    this._paintVeil(live, { busy: true });
    if (!this._liveTick && this.isConnected) this._startLiveCheck();
    return live;
  }

  _mountLive(live) {
    live.since = Date.now();
    live.failedAt = 0;
    window.loadCardHelpers().then((helpers) => {
      const card = this._liveCard(helpers, live.entity);
      if (live.card) live.card.replaceWith(card);
      else live.holder.prepend(card);
      live.card = card;
    });
  }

  _startLiveCheck() {
    this._liveTick = setInterval(() => this._checkLives(), LIVE_CHECK);
  }

  _checkLives() {
    for (const live of this._lives) {
      if (!live.holder.isConnected) continue;
      const state = this._liveState(live);
      if (!state.fail) live.failedAt = 0;
      else if (!live.failedAt) live.failedAt = Date.now();
      this._paintVeil(live, state);
      // Home Assistant's player gives up for good on some errors; a new card starts over.
      if (state.fail === "camera_failed" && Date.now() - live.failedAt > RETRY) this._mountLive(live);
    }
    if (!this._lives.size) {
      clearInterval(this._liveTick);
      this._liveTick = null;
    }
  }

  _liveState(live) {
    const stateObj = this._hass.states[live.entity];
    if (!stateObj || stateObj.state === "unavailable") return { fail: "camera_offline" };
    const found = [];
    const walk = (root) => {
      for (const el of root.querySelectorAll("*")) {
        if (el.tagName === "VIDEO" || el.tagName === "IMG" || el.tagName === "HA-ALERT") found.push(el);
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    // Only the picture card: the veil's own logo is an image too.
    if (live.card && live.card.shadowRoot) walk(live.card.shadowRoot);
    const alert = found.find((el) => el.tagName === "HA-ALERT");
    if (alert) return { fail: "camera_failed", detail: alert.textContent.trim() };
    const playing = found.some((el) => (el.tagName === "VIDEO"
      ? el.readyState > 1 : el.tagName === "IMG" && el.complete && el.naturalWidth > 0));
    if (playing) return {};
    return Date.now() - live.since > STALL ? { fail: "camera_failed" } : { busy: true };
  }

  _paintVeil(live, state) {
    const key = state.fail ? `${state.fail}|${state.detail || ""}` : state.busy ? "busy" : "";
    if (live.shown === key) return;
    live.shown = key;
    if (live.veil) live.veil.remove();
    live.veil = state.fail ? this._failed(state) : state.busy ? this._busy() : null;
    // Last in the holder, so it paints over the picture card.
    if (live.veil) live.holder.append(live.veil);
  }

  _renderLive(body) {
    const cameras = this._cameras();
    this._shown = cameras.join();
    this._grid.classList.add("live");
    const used = cameras.map((entityId) => {
      const cell = this._cell(entityId, this._cameraChannel(entityId));
      cell.el.className = "cell";
      cell.tag.textContent = this._name(entityId);
      cell.tag.hidden = false;
      cell.badge.hidden = true;
      this._paint(cell, entityId);
      return cell;
    });
    this._layout(used);
    if (!cameras.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = this._t("no_cameras");
      this._wrap.hidden = true;
      body.append(empty);
    }
  }

  _day(offset = 0) {
    const [y, m, d] = this._rec.day.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + offset));
    return date.toISOString().slice(0, 10);
  }

  // The DVR's day is Home Assistant's, which may not be the clock of this browser.
  _nowSecond() {
    if (!this._zone) {
      this._zone = new Intl.DateTimeFormat("en-GB", {
        timeZone: this._hass.config.time_zone, hourCycle: "h23",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      });
    }
    const [h, m, s] = this._zone.format(new Date()).split(":").map(Number);
    return h * 3600 + m * 60 + s;
  }

  _isToday() {
    return !!this._rec.day && this._rec.day === this._rec.today;
  }

  // Today's live picture stays while today's recordings load, so switching views keeps it playing.
  _showsLive() {
    const rec = this._rec;
    return rec.at == null && !rec.note && (this._isToday() || (rec.day == null && !rec.error));
  }

  _fetchRanges(channel = this._rec.channel) {
    return this._hass.callWS({
      type: "intelbras_dvr/recordings",
      channel,
      ...(this._rec.day ? { day: this._rec.day } : {}),
    });
  }

  async _loadDay(change = {}) {
    this._stop();
    Object.assign(this._rec, change, { ranges: null, error: null, cursor: null });
    this._render();
    this._startTick();
    const asked = `${this._rec.channel}|${this._rec.day}`;
    try {
      const answer = await this._fetchRanges();
      if (asked !== `${this._rec.channel}|${this._rec.day}`) return;
      const others = await this._otherRanges(answer.day);
      if (asked !== `${this._rec.channel}|${this._rec.day}`) return;
      Object.assign(this._rec, {
        entry: answer.entry_id,
        day: answer.day,
        today: answer.today,
        channels: answer.channels,
        ranges: answer.ranges,
        others,
      });
      this._refreshed = Date.now();
    } catch (err) {
      this._rec.ranges = [];
      this._rec.error = this._t("browse_failed", { err: err.message || String(err) });
    }
    if (this._view !== "rec") return;
    // Another day opens on its first recording; today opens live, at the present.
    if (!this._isToday() && this._rec.ranges.length) this._rec.cursor = this._rec.ranges[0][0];
    this._render();
  }

  // Each channel has its own gaps, and its video time has to be read against them.
  async _otherRanges(day) {
    const found = {};
    if (!this._all) return found;
    await Promise.all(this._allChannels().filter((channel) => channel !== this._rec.channel)
      .map(async (channel) => {
        try {
          found[channel] = (await this._hass.callWS({
            type: "intelbras_dvr/recordings", channel, ...(day ? { day } : {}),
          })).ranges;
        } catch (_) { /* played without knowing its gaps */ }
      }));
    return found;
  }

  _drop(token) {
    if (token) this._hass.callWS({ type: "intelbras_dvr/playback/stop", token }).catch(() => {});
  }

  _stop() {
    this._player = null;
    this._ask = (this._ask || 0) + 1;
    this._drop(this._rec.token);
    Object.assign(this._rec, { at: null, url: null, token: null, note: null, paused: false });
    for (const other of this._others) {
      this._drop(other.token);
      Object.assign(other, { at: null, url: null, token: null, note: null, player: null });
    }
  }

  _goLive() {
    this._stop();
    if (!this._isToday()) {
      this._loadDay({ day: null });
      return;
    }
    this._rec.cursor = null;
    this._fillPlayer();
    this._follow();
  }

  // The DVR joins the recorded stretches, so the video skips the gaps the clock has.
  _clockOf(offset) {
    const at = this._rec.at;
    let left = offset * (this._rec.speed || 1);
    let last = at;
    for (const [from, to] of this._rec.ranges || []) {
      if (to <= at) continue;
      const begin = Math.max(from, at);
      if (left < to - begin) return begin + left;
      left -= to - begin;
      last = to;
    }
    return last + left;
  }

  _offsetOf(second, at = this._rec.at, ranges = this._rec.ranges) {
    let total = 0;
    for (const [from, to] of ranges || []) {
      if (to <= at) continue;
      const begin = Math.max(from, at);
      if (second < begin) break;
      total += Math.min(second, to) - begin;
      if (second < to) break;
    }
    return total / (this._rec.speed || 1);
  }

  async _playAt(second) {
    const rec = this._rec;
    const ranges = rec.ranges || [];
    const today = this._isToday();
    if (today && second >= this._nowSecond() - 5) {
      this._goLive();
      return;
    }
    const inside = ranges.find(([from, to]) => second >= from && second < to - 2);
    const next = inside ? null : ranges.find(([from]) => from > second);
    if (!inside && !next) {
      if (today) {
        this._goLive();
        return;
      }
      this._stop();
      rec.note = this._t("no_recording_there");
      rec.cursor = second;
      this._fillPlayer();
      return;
    }
    const at = Math.max(0, Math.floor(inside ? second : next[0]));
    // A moment the player already holds is only a jump inside the same video.
    const video = this._video();
    if (video && rec.url && rec.at != null && at >= rec.at && rec.speed === rec.rate &&
        video.seekable.length) {
      const offset = this._offsetOf(at);
      if (offset <= video.seekable.end(video.seekable.length - 1) - 2) {
        video.currentTime = offset;
        rec.cursor = at;
        if (!rec.paused) video.play().catch(() => {});
        this._syncOthers(0.5);
        this._follow();
        return;
      }
    }
    this._stop();
    Object.assign(rec, { at, cursor: at, speed: rec.rate });
    this._fillPlayer();
    this._follow();
    const ask = this._ask;
    const start = (channel) => this._hass.callWS({
      type: "intelbras_dvr/playback/start",
      channel,
      day: rec.day,
      second: Math.min(at, DAY - 1),
      length: WINDOW,
      ...(rec.speed > 1 ? { speed: rec.speed } : {}),
      ...(this._all ? { width: SMALL_WIDTH } : {}),
      ...(rec.entry ? { entry_id: rec.entry } : {}),
    });
    const address = (url) => new URL(url, this._hass.hassUrl ? this._hass.hassUrl() : location.origin).href;
    for (const other of this._others) {
      const ranges = (rec.others || {})[other.channel];
      if (ranges && !ranges.some(([from, to]) => at >= from && at < to - 2)) {
        other.note = this._t("no_recording_there");
        this._fillOther(other);
        continue;
      }
      other.at = at;
      this._fillOther(other);
      start(other.channel).then((media) => {
        if (this._ask !== ask) {
          this._drop(media.token);
          return;
        }
        other.token = media.token;
        other.url = address(media.url);
        this._fillOther(other);
      }).catch((err) => {
        if (this._ask !== ask) return;
        other.at = null;
        other.note = this._t("play_failed", { err: err.message || String(err) });
        this._fillOther(other);
      });
    }
    try {
      const media = await start(rec.channel);
      if (this._ask !== ask) {
        this._drop(media.token);
        return;
      }
      rec.token = media.token;
      rec.url = address(media.url);
    } catch (err) {
      if (this._ask !== ask) return;
      this._stop();
      rec.note = this._t("play_failed", { err: err.message || String(err) });
    }
    if (this._view === "rec") this._fillPlayer();
  }

  _video(player = this._player) {
    if (!player) return null;
    return player.tagName === "VIDEO"
      ? player
      : player.shadowRoot && player.shadowRoot.querySelector("video");
  }

  _togglePause() {
    const rec = this._rec;
    if (rec.at == null) return;
    const video = this._video();
    if (rec.paused) {
      if (!video || Date.now() - this._pausedAt > PAUSE_LIMIT) {
        this._playAt(rec.cursor);
        return;
      }
      rec.paused = false;
      video.play().catch(() => {});
    } else {
      rec.paused = true;
      this._pausedAt = Date.now();
      if (video) video.pause();
    }
    this._syncOthers();
    this._syncControls(rec.cursor);
  }

  // The server converts at the chosen speed, so a new speed asks again from the same moment.
  _setRate(rate) {
    const rec = this._rec;
    rec.rate = rate;
    if (rec.at != null && rec.cursor != null) this._playAt(rec.cursor);
    this._syncControls();
  }

  // Videos always play at 1x; hls.js would otherwise speed up to catch the end of the playlist.
  _holdRate(video, player = this._player) {
    const keep = () => {
      if (this._video(player) === video && video.playbackRate !== 1) video.playbackRate = 1;
    };
    if (!video.dataset.held) {
      video.dataset.held = "1";
      video.addEventListener("ratechange", keep);
      const hls = player && player._hlsPolyfillInstance;
      if (hls && hls.config) hls.config.maxLiveSyncPlaybackRate = 1;
    }
    keep();
  }

  // The other channels are kept on the moment the first one shows.
  _syncOthers(slack = 3) {
    const rec = this._rec;
    if (rec.at == null || rec.cursor == null) return;
    for (const other of this._others) {
      const video = this._video(other.player);
      if (!video || other.at == null) continue;
      this._holdRate(video, other.player);
      if (rec.paused) {
        if (!video.paused) video.pause();
      } else if (video.paused && video.readyState > 1) {
        video.play().catch(() => {});
      }
      if (!video.seekable.length) continue;
      const want = this._offsetOf(rec.cursor, other.at, (rec.others || {})[other.channel] || rec.ranges);
      const ready = video.seekable.end(video.seekable.length - 1);
      if (Math.abs((video.currentTime || 0) - want) > slack && want <= ready - 1) video.currentTime = want;
    }
  }

  _fillOther(other) {
    const rec = this._rec;
    const cell = other.cell;
    const camera = this._showsLive() ? this._channelCamera(other.channel) : null;
    const waiting = !other.note && (other.at != null || rec.at != null || (!rec.note && !rec.error &&
      rec.ranges === null));
    const hint = other.note || (other.at != null || rec.at != null
      ? this._t("starting")
      : rec.note || rec.error || (rec.ranges === null ? this._t("loading") : ""));
    const shown = camera ? `live|${camera}` : other.url ? `video|${other.url}` : `hint|${hint}`;
    if (cell.shown === shown) return;
    other.player = null;
    cell.el.className = camera ? "player live" : "player";
    cell.badge.hidden = true;
    const nodes = [];
    if (camera) {
      this._paint(cell, camera, nodes, shown);
      return;
    }
    if (other.url) {
      const apple = (navigator.vendor || "").startsWith("Apple") &&
        document.createElement("video").canPlayType("application/vnd.apple.mpegurl");
      const own = !apple && customElements.get("ha-hls-player");
      const player = document.createElement(own ? "ha-hls-player" : "video");
      player.className = "video";
      player.controls = false;
      player.muted = true;
      player.playsInline = true;
      if (own) {
        player.hass = this._hass;
        player.autoPlay = true;
        player.url = other.url;
      } else {
        player.autoplay = true;
        player.setAttribute("playsinline", "");
        player.addEventListener("loadedmetadata", () => {
          if (!rec.paused) player.play().catch(() => {});
        });
        player.src = other.url;
      }
      other.player = player;
      nodes.push(player, this._veil(player));
    } else if (waiting) {
      nodes.push(this._busy());
    } else {
      const text = document.createElement("div");
      text.className = "hint";
      text.textContent = hint;
      nodes.push(text);
    }
    this._paint(cell, camera, nodes, shown);
  }

  // Home Assistant's own launch logo, served by the instance itself.
  _busy() {
    const box = document.createElement("div");
    box.className = "hint busy";
    const logo = document.createElement("img");
    logo.src = LOADING_LOGO;
    logo.alt = "";
    logo.addEventListener("error", () => logo.remove());
    const text = document.createElement("span");
    text.textContent = this._t("loading");
    box.append(logo, text);
    return box;
  }

  _failed(state) {
    const box = document.createElement("div");
    box.className = "hint fail";
    box.setAttribute("role", "status");
    box.innerHTML = FAILED_LOGO;
    // Home Assistant's own message is English only; it stays reachable on hover.
    if (state.detail) box.title = state.detail;
    const text = document.createElement("strong");
    text.textContent = this._t(state.fail);
    box.append(text);
    if (state.fail === "camera_failed") {
      const next = document.createElement("span");
      next.textContent = this._t("retrying");
      box.append(next);
    }
    return box;
  }

  // The loader stays over a new player until its first picture.
  _veil(player) {
    const busy = this._busy();
    const done = () => busy.remove();
    const hook = () => {
      const video = this._video(player);
      if (!video) return false;
      if (video.readyState > 2) done();
      video.addEventListener("playing", done, { once: true });
      video.addEventListener("loadeddata", done, { once: true });
      return true;
    };
    if (!hook()) Promise.resolve(player.updateComplete).then(() => hook() || setTimeout(hook, 300));
    return busy;
  }

  _isLive() {
    return this._rec.at == null && this._isToday() && !this._seeking && !this._rec.note;
  }

  _startTick() {
    clearInterval(this._tick);
    this._tick = setInterval(() => this._onTick(), 1000);
  }

  _onTick() {
    const rec = this._rec;
    if (this._view !== "rec" || !this._parts) return;
    const video = this._video();
    if (this._isToday() && Date.now() - (this._refreshed || 0) > 120000) this._refreshRanges();
    if (video && rec.at != null) this._holdRate(video);
    if (this._seeking || rec.paused) return;
    if (video && rec.at != null) {
      rec.cursor = this._clockOf(video.currentTime || 0);
      this._syncOthers();
      if (video.ended) {
        if (this._ending === video) return;
        this._ending = video;
        const end = Number.isFinite(video.duration) ? this._clockOf(video.duration) : rec.at + WINDOW;
        const next = Math.max(rec.at + 1, Math.ceil(end));
        // Today has grown while this stretch played, so the recorded ranges are read again first.
        if (next < DAY) (this._isToday() ? this._refreshRanges() : Promise.resolve()).then(() => this._playAt(next));
        return;
      }
    }
    this._follow();
  }

  // Today keeps growing, so the recorded stretch is drawn again from time to time.
  async _refreshRanges() {
    this._refreshed = Date.now();
    const asked = `${this._rec.channel}|${this._rec.day}`;
    try {
      const answer = await this._fetchRanges();
      if (asked !== `${this._rec.channel}|${this._rec.day}` || !this._parts) return;
      this._rec.ranges = answer.ranges;
      this._rec.today = answer.today;
      this._drawBlocks();
    } catch (_) { /* the next round tries again */ }
  }

  _center() {
    const { scroll, track } = this._parts;
    if (!track.offsetWidth) return 0;
    return Math.max(0, Math.min(DAY - 1, (scroll.scrollLeft / track.offsetWidth) * DAY));
  }

  _scrollTo(second) {
    const { scroll, track } = this._parts;
    const left = Math.round((second / DAY) * track.offsetWidth);
    if (Math.abs(scroll.scrollLeft - left) < 1) return;
    this._autoUntil = performance.now() + 250;
    scroll.scrollLeft = left;
  }

  _shownSecond() {
    if (this._seeking) return this._center();
    if (this._isLive()) return this._nowSecond();
    return this._rec.cursor != null ? this._rec.cursor : this._center();
  }

  // Keeps the needle on the moment being shown: the present when live, the video otherwise.
  _follow() {
    if (!this._parts || this._seeking) return;
    const second = this._shownSecond();
    this._scrollTo(second);
    this._syncControls(second);
    this._drawTicks();
  }

  _syncControls(second) {
    const parts = this._parts;
    if (!parts) return;
    const rec = this._rec;
    parts.now.textContent = rec.ranges === null
      ? this._t("loading")
      : clock(second != null ? second : this._shownSecond());
    parts.live.classList.toggle("on", this._isLive());
    parts.pause.disabled = rec.at == null;
    parts.pause.querySelector("ha-icon").setAttribute("icon", rec.paused ? "mdi:play" : "mdi:pause");
    parts.pause.title = this._t(rec.paused ? "play" : "pause");
    parts.pause.setAttribute("aria-label", parts.pause.title);
    parts.rate.disabled = rec.at == null;
    parts.rate.classList.toggle("on", rec.at != null && rec.rate !== 1);
    parts.rate.querySelector("span").textContent = `${rec.at == null ? 1 : rec.rate}x`;
  }

  _setSpan(seconds) {
    const second = this._shownSecond();
    this._rec.span = seconds;
    this._sizeTrack();
    this._scrollTo(second);
    this._ticksKey = null;
    this._drawTicks();
    this._parts.span.querySelector("span").textContent =
      SPANS.find((entry) => entry.seconds === seconds).label;
  }

  // Half a strip of padding on each side lets midnight reach the needle.
  _sizeTrack() {
    const { scroll, track } = this._parts;
    const width = scroll.parentNode.clientWidth;
    track.parentNode.style.padding = `0 ${width / 2}px`;
    track.style.width = `${Math.round(width * (DAY / this._rec.span))}px`;
  }

  _drawBlocks() {
    const { track } = this._parts;
    for (const old of track.querySelectorAll(".block")) old.remove();
    for (const [from, to] of this._rec.ranges || []) {
      const block = document.createElement("div");
      block.className = "block";
      block.style.left = `${(from / DAY) * 100}%`;
      block.style.width = `${((to - from) / DAY) * 100}%`;
      track.prepend(block);
    }
  }

  // Only the labels near the needle exist: at ten minutes across, a day is a very long strip.
  _drawTicks() {
    const { track } = this._parts;
    const span = SPANS.find((entry) => entry.seconds === this._rec.span);
    const center = this._center();
    const first = Math.max(0, Math.floor((center - span.seconds) / span.step) * span.step);
    const last = Math.min(DAY, center + span.seconds);
    const key = `${span.seconds}|${first}|${track.offsetWidth}`;
    if (key === this._ticksKey) return;
    this._ticksKey = key;
    for (const old of track.querySelectorAll(".tick")) old.remove();
    for (let second = first; second <= last; second += span.step) {
      const tick = document.createElement("div");
      tick.className = "tick";
      tick.style.left = `${(second / DAY) * track.offsetWidth}px`;
      tick.textContent = second >= DAY ? "24:00" : clock(second, false);
      track.append(tick);
    }
  }

  _fillPlayer() {
    const parts = this._parts;
    if (!parts) return;
    const rec = this._rec;
    const cell = parts.cell;
    this._player = null;
    const camera = this._showsLive() ? this._channelCamera(rec.channel) : null;
    cell.el.className = camera ? "player live" : "player";
    this._grid.classList.toggle("live", !!camera);
    cell.badge.hidden = !camera || this._all;
    cell.badge.textContent = this._t("live");
    const nodes = [];
    if (camera) {
      this._paint(cell, camera);
    } else if (rec.url) {
      // Safari plays HLS by itself; elsewhere Home Assistant's player is the steady one.
      const apple = (navigator.vendor || "").startsWith("Apple") &&
        document.createElement("video").canPlayType("application/vnd.apple.mpegurl");
      const own = (!apple || rec.plain === false) && customElements.get("ha-hls-player");
      const player = document.createElement(own ? "ha-hls-player" : "video");
      player.className = "video";
      player.controls = false;
      player.muted = true;
      if (own) {
        player.hass = this._hass;
        player.autoPlay = true;
        player.playsInline = true;
        player.url = rec.url;
      } else {
        player.autoplay = true;
        player.playsInline = true;
        player.setAttribute("playsinline", "");
        player.addEventListener("loadedmetadata", () => {
          if (!rec.paused) player.play().catch(() => {});
        });
        player.addEventListener("error", () => {
          if (this._player !== player) return;
          // One more try with Home Assistant's player before giving up.
          if (rec.plain !== false && customElements.get("ha-hls-player")) {
            rec.plain = false;
            this._fillPlayer();
            return;
          }
          const code = player.error ? player.error.code : "?";
          this._stop();
          rec.note = this._t("play_failed", { err: `video error ${code}` });
          this._fillPlayer();
        });
        player.src = rec.url;
      }
      this._player = player;
      nodes.push(player, this._veil(player));
    } else {
      const text = rec.note || rec.error || (rec.at != null
        ? this._t("starting")
        : rec.ranges === null
          ? this._t("loading")
          : rec.ranges.length ? this._t("pick_time") : this._t("no_recordings_day"));
      if (!rec.note && !rec.error && (rec.at != null || rec.ranges === null)) {
        nodes.push(this._busy());
      } else {
        const hint = document.createElement("div");
        hint.className = "hint";
        hint.textContent = text;
        nodes.push(hint);
      }
    }
    if (!camera) this._paint(cell, null, nodes);
    if (this._all) for (const other of this._others) this._fillOther(other);
    this._syncControls();
  }

  _renderTimeline(box) {
    const rec = this._rec;
    const kept = this._others;
    this._others = [];
    const channels = this._all ? this._allChannels() : [];
    if (!channels.includes(rec.channel)) channels.unshift(rec.channel);
    const used = channels.map((channel) => {
      const cell = this._cell(this._channelCamera(channel), channel);
      cell.tag.textContent = this._label(channel);
      cell.tag.hidden = !this._all;
      if (channel !== rec.channel) {
        const before = kept.find((other) => other.channel === channel) || {};
        this._others.push({ at: null, url: null, token: null, note: null, player: null,
          ...before, channel, cell });
      }
      return cell;
    });
    this._layout(used);
    const cell = used[channels.indexOf(rec.channel)];

    const chips = document.createElement("div");
    chips.className = "chips";
    for (let channel = 1; channel <= (rec.channels || this._ownCameras().length || 1); channel += 1) {
      chips.append(this._button("", this._t("channel", { n: channel }),
        () => channel !== rec.channel && this._loadDay({ channel }),
        { on: channel === rec.channel, cls: "pill" }));
    }

    const nav = document.createElement("div");
    nav.className = "nav";
    const date = document.createElement("input");
    date.type = "date";
    date.value = rec.day || "";
    date.max = rec.today || "";
    date.setAttribute("aria-label", this._t("date"));
    date.addEventListener("change", () => date.value && this._loadDay({ day: date.value }));
    const next = this._button("mdi:chevron-right", this._t("next_day"),
      () => this._loadDay({ day: this._day(1) }), { text: false, cls: "round" });
    next.disabled = !rec.day || rec.day >= (rec.today || "");
    const prev = this._button("mdi:chevron-left", this._t("prev_day"),
      () => rec.day && this._loadDay({ day: this._day(-1) }), { text: false, cls: "round" });
    const gap = document.createElement("div");
    gap.className = "gap";
    const span = this._button("mdi:arrow-expand-horizontal",
      SPANS.find((entry) => entry.seconds === rec.span).label, () => {
        const index = SPANS.findIndex((entry) => entry.seconds === this._rec.span);
        this._setSpan(SPANS[(index + 1) % SPANS.length].seconds);
      }, { cls: "pill" });
    span.title = this._t("scale");
    span.setAttribute("aria-label", span.title);
    nav.append(prev, date, next, gap, span);

    const now = document.createElement("div");
    now.className = "now";

    const timeline = document.createElement("div");
    timeline.className = "timeline";
    const scroll = document.createElement("div");
    scroll.className = "scroll";
    const padding = document.createElement("div");
    padding.className = "pad";
    const track = document.createElement("div");
    track.className = "track";
    padding.append(track);
    scroll.append(padding);
    const needle = document.createElement("div");
    needle.className = "needle";
    timeline.append(scroll, needle);

    const transport = document.createElement("div");
    transport.className = "transport";
    const left = document.createElement("div");
    left.className = "side";
    const right = document.createElement("div");
    right.className = "side end";
    const jump = (step) => this._playAt(Math.max(0, this._shownSecond() + step));
    const pause = this._button("mdi:pause", this._t("pause"), () => this._togglePause(),
      { text: false, cls: "round main" });
    const live = this._button("", this._t("live"), () => this._goLive(), { cls: "pill golive" });
    right.append(live);
    const rate = this._button("mdi:play-speed", "1x", () => {
      const rates = this._all ? RATES_ALL : RATES;
      this._setRate(rates[(rates.indexOf(this._rec.rate) + 1) % rates.length]);
    }, { cls: "pill" });
    rate.title = this._t("speed");
    rate.setAttribute("aria-label", rate.title);
    left.append(rate);
    transport.append(
      left,
      this._button("mdi:rewind-60", this._t("back_1m"), () => jump(-60), { text: false, cls: "round" }),
      pause,
      this._button("mdi:fast-forward-60", this._t("fwd_1m"), () => jump(60), { text: false, cls: "round" }),
      right);

    box.append(...(this._all ? [] : [chips]), nav, now, timeline, transport);
    this._parts = { cell, now, scroll, track, span, pause, live, rate };
    this._ticksKey = null;
    this._seeking = false;
    this._wireScroll(scroll);
    this._fillPlayer();
    this._drawBlocks();
    // Widths are only real once the browser has laid the new nodes out.
    requestAnimationFrame(() => {
      if (!this._parts || this._parts.scroll !== scroll) return;
      this._sizeTrack();
      this._follow();
    });
    if (!this._resize) {
      this._resize = new ResizeObserver(() => {
        if (!this._parts || this._seeking) return;
        const second = this._shownSecond();
        this._sizeTrack();
        this._ticksKey = null;
        this._scrollTo(second);
        this._drawTicks();
      });
    }
    this._resize.disconnect();
    this._resize.observe(scroll);
  }

  // Dragging the strip under the needle picks the moment; letting go plays from there.
  _wireScroll(scroll) {
    let settle = null;
    let held = false;
    let drag = null;
    const arm = () => {
      clearTimeout(settle);
      settle = setTimeout(() => {
        if (held || drag) return;
        if (!this._parts || this._parts.scroll !== scroll || !this._seeking) return;
        const second = this._center();
        this._seeking = false;
        this._playAt(second);
      }, 450);
    };
    scroll.addEventListener("scroll", () => {
      if (performance.now() < (this._autoUntil || 0)) return;
      this._seeking = true;
      this._parts.now.textContent = clock(this._center());
      this._parts.live.classList.remove("on");
      this._drawTicks();
      arm();
    }, { passive: true });
    scroll.addEventListener("touchstart", () => { held = true; }, { passive: true });
    const lift = () => {
      held = false;
      if (this._seeking) arm();
    };
    scroll.addEventListener("touchend", lift, { passive: true });
    scroll.addEventListener("touchcancel", lift, { passive: true });
    // A finger scrolls the strip natively; a mouse needs the drag done by hand.
    scroll.addEventListener("pointerdown", (ev) => {
      if (ev.pointerType !== "mouse" || ev.button !== 0) return;
      drag = { x: ev.clientX, left: scroll.scrollLeft, moved: false };
      scroll.setPointerCapture(ev.pointerId);
      scroll.classList.add("drag");
    });
    scroll.addEventListener("pointermove", (ev) => {
      if (!drag) return;
      const delta = ev.clientX - drag.x;
      if (Math.abs(delta) > 3) drag.moved = true;
      if (drag.moved) {
        this._autoUntil = 0;
        scroll.scrollLeft = drag.left - delta;
      }
    });
    const release = (ev) => {
      if (!drag) return;
      const moved = drag.moved;
      drag = null;
      scroll.classList.remove("drag");
      this._autoUntil = 0;
      if (moved) {
        if (this._seeking) arm();
        return;
      }
      // A plain click brings that point under the needle.
      const box = scroll.getBoundingClientRect();
      scroll.scrollLeft += ev.clientX - (box.left + box.width / 2);
    };
    scroll.addEventListener("pointerup", release);
    scroll.addEventListener("pointercancel", release);
  }
}

customElements.define("intelbras-dvr-card", IntelbrasDvrCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "intelbras-dvr-card",
  name: tn("card_name"),
  description: tn("card_desc"),
  preview: true,
});
