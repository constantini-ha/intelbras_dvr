import { t, tn } from "./i18n.js";

const PLATFORM = "intelbras_dvr";
const ROOT = "media-source://intelbras_dvr";
// How much video one request to the DVR covers, in seconds.
const WINDOW = 1800;
const DAY = 86400;
// How much of the day fits across the timeline, and the gap between its labels.
const SPANS = [
  { seconds: 600, label: "10 min", step: 120 },
  { seconds: 3600, label: "1 h", step: 600 },
  { seconds: 21600, label: "6 h", step: 3600 },
  { seconds: 86400, label: "24 h", step: 14400 },
];

const STYLE = `
  :host { display:block }
  ha-card { overflow:hidden; display:flex; flex-direction:column }
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
  button[disabled] { opacity:.35; cursor:default }
  .bar button { min-height:36px; padding:0 10px; border-radius:18px; font-size:13px;
    color:var(--secondary-text-color) }
  .bar button:hover { background:var(--secondary-background-color) }
  .bar button.on { color:var(--primary-color);
    background:color-mix(in srgb, var(--primary-color) 14%, transparent) }
  .bar button.icon { padding:0 8px }
  :host(.full) .bar button:not(.on), :host(:fullscreen) .bar button:not(.on) { color:#fff }
  :host(.full) .bar button:hover, :host(:fullscreen) .bar button:hover { background:rgba(255,255,255,.16) }
  .grid { display:grid; gap:3px; background:#000; flex:1; min-height:0 }
  .cell { position:relative; background:#000; overflow:hidden; min-width:0; min-height:72px }
  .stream > * { display:block; --ha-card-border-radius:0; --ha-card-border-width:0;
    --ha-card-box-shadow:none; --ha-card-background:#000 }
  .cell .tap { position:absolute; inset:0 }
  .cell .tap:focus-visible { outline-offset:-2px }
  .cell .name { position:absolute; right:8px; bottom:8px; padding:2px 8px; border-radius:10px;
    background:rgba(0,0,0,.55); color:#fff; font-size:12px; pointer-events:none }
  :host(.full) .grid, :host(:fullscreen) .grid { align-content:center }
  .empty { padding:24px 16px; color:var(--secondary-text-color); text-align:center }

  .rec { display:flex; flex-direction:column; min-height:0; flex:1;
    background:var(--card-background-color); color:var(--primary-text-color) }
  .player { position:relative; background:#000; aspect-ratio:16/9; max-height:62vh; overflow:hidden }
  .player > .video { display:block; width:100%; height:100% }
  .player.live { aspect-ratio:auto; max-height:none; min-height:72px }
  :host(.full) .player, :host(:fullscreen) .player { flex:1; min-height:0; max-height:none;
    aspect-ratio:auto; display:flex; align-items:center; justify-content:center }
  :host(.full) .player.live > .stream, :host(:fullscreen) .player.live > .stream {
    width:min(100%, calc((100vh - 330px) * 1.5)) }
  .hint { position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
    padding:16px; text-align:center; color:rgba(255,255,255,.78); font-size:14px }
  .badge { position:absolute; left:8px; top:8px; display:flex; align-items:center; gap:6px;
    padding:3px 9px; border-radius:10px; background:rgba(0,0,0,.55); color:#fff; font-size:12px;
    pointer-events:none }
  .badge::before { content:""; width:7px; height:7px; border-radius:50%; background:#ff4d4d }
  .chips { display:flex; gap:6px; padding:10px 12px 0; overflow-x:auto; scrollbar-width:none }
  .chips::-webkit-scrollbar { display:none }
  .pill { flex:none; min-height:36px; padding:0 14px; border-radius:18px; font-size:13px;
    white-space:nowrap; border:1px solid var(--outline-color, var(--divider-color)) }
  .pill:not([disabled]):hover { background:var(--secondary-background-color) }
  .pill.on { border-color:transparent; background:var(--primary-color); color:var(--text-primary-color) }
  .nav { display:flex; align-items:center; gap:6px; padding:10px 12px 0 }
  .nav input { box-sizing:border-box; flex:1; min-width:0; max-width:190px; font:inherit; font-size:14px;
    min-height:36px; padding:0 10px; border-radius:18px;
    border:1px solid var(--outline-color, var(--divider-color)); background:transparent;
    color:var(--primary-text-color); color-scheme:light dark }
  .nav input:focus-visible { outline:2px solid var(--primary-color); outline-offset:1px }
  .round { flex:none; width:36px; height:36px; border-radius:50% }
  .round:not([disabled]):hover { background:var(--secondary-background-color) }
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
    this._rec = { channel: 1, day: null, ranges: null, span: 3600, at: null, cursor: null };
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
    for (const card of this._streams) card.hass = hass;
    if (this._recLive && this._recLive.card) this._recLive.card.hass = hass;
    if (this._player && "hass" in this._player) this._player.hass = hass;
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
  }

  disconnectedCallback() {
    document.removeEventListener("fullscreenchange", this._onFull);
    document.removeEventListener("keydown", this._onKey);
    clearInterval(this._tick);
    this._tick = null;
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

  _isFull() {
    return this.classList.contains("full") || document.fullscreenElement === this;
  }

  async _toggleFull() {
    if (this._isFull()) {
      if (document.fullscreenElement === this) await document.exitFullscreen();
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

  _render() {
    const root = this.shadowRoot;
    root.innerHTML = "";
    this._streams = [];
    this._player = null;
    this._parts = null;
    const style = document.createElement("style");
    style.textContent = STYLE;
    const card = document.createElement("ha-card");
    root.append(style, card);

    const bar = document.createElement("div");
    bar.className = "bar";
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = this._config.title || this._t("cameras");
    bar.append(
      title,
      this._button("mdi:view-grid-outline", this._t("mosaic"), () => this._show("live"),
        { on: this._view === "live" }),
      this._button("mdi:cctv", this._t("camera"), () => this._show("rec"),
        { on: this._view === "rec" }),
      this._button("mdi:fullscreen", this._t("fullscreen"), () => this._toggleFull(),
        { text: false, cls: "fullbtn" })
    );
    card.append(bar);
    this._syncFullButton();

    if (this._view === "live") this._renderLive(card);
    else this._renderTimeline(card);
  }

  _show(view, channel) {
    if (view === this._view && !channel) return;
    this._view = view;
    if (view === "rec") {
      this._loadDay({ day: null, ...(channel ? { channel } : {}) });
      return;
    }
    this._stop();
    this._recLive = null;
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

  // Kept across renders, so loading a day does not restart the live picture.
  _liveHolder(entityId) {
    if (this._recLive && this._recLive.entity === entityId) return this._recLive.holder;
    const holder = document.createElement("div");
    holder.className = "stream";
    const mine = { entity: entityId, holder, card: null };
    this._recLive = mine;
    window.loadCardHelpers().then((helpers) => {
      mine.card = this._liveCard(helpers, entityId);
      holder.append(mine.card);
    });
    return holder;
  }

  async _renderLive(card) {
    const cameras = this._cameras();
    this._shown = cameras.join();
    if (!cameras.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = this._t("no_cameras");
      card.append(empty);
      return;
    }
    const grid = document.createElement("div");
    grid.className = "grid";
    const columns = Math.max(1, Math.min(Number(this._config.columns) || 2, cameras.length));
    grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
    card.append(grid);

    const helpers = await window.loadCardHelpers();
    if (!grid.isConnected) return;
    for (const entityId of cameras) {
      const cell = document.createElement("div");
      cell.className = "cell";
      const stream = document.createElement("div");
      stream.className = "stream";
      const live = this._liveCard(helpers, entityId);
      this._streams.push(live);
      stream.append(live);
      const tap = document.createElement("button");
      tap.className = "tap";
      const name = this._name(entityId);
      tap.setAttribute("aria-label", name);
      // A tap opens that camera alone, with its timeline.
      tap.addEventListener("click", () => this._show("rec", this._cameraChannel(entityId)));
      const label = document.createElement("div");
      label.className = "name";
      label.textContent = name;
      cell.append(stream, tap, label);
      grid.append(cell);
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

  _fetchRanges() {
    return this._hass.callWS({
      type: "intelbras_dvr/recordings",
      channel: this._rec.channel,
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
      Object.assign(this._rec, {
        entry: answer.entry_id,
        day: answer.day,
        today: answer.today,
        channels: answer.channels,
        ranges: answer.ranges,
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

  _stop() {
    this._player = null;
    Object.assign(this._rec, { at: null, url: null, note: null, paused: false });
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

  // The DVR plays from an instant, so moving on the timeline starts a new stream there.
  async _playAt(second) {
    const ranges = this._rec.ranges || [];
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
      this._rec.note = this._t("no_recording_there");
      this._rec.cursor = second;
      this._fillPlayer();
      return;
    }
    const at = Math.max(0, Math.floor(inside ? second : next[0]));
    this._stop();
    this._recLive = null;
    Object.assign(this._rec, { at, cursor: at });
    this._fillPlayer();
    this._follow();
    const stamp = (value) => {
      const s = Math.min(value, DAY - 1);
      return this._rec.day.replaceAll("-", "") +
        pad(Math.floor(s / 3600)) + pad(Math.floor((s % 3600) / 60)) + pad(s % 60);
    };
    try {
      const media = await this._hass.callWS({
        type: "media_source/resolve_media",
        media_content_id:
          `${ROOT}/PLAY|${this._rec.entry}|${this._rec.channel}|${stamp(at)}|${stamp(at + WINDOW)}`,
      });
      if (this._rec.at !== at) return;
      // The player resolves the master playlist against this address, so it must be absolute.
      this._rec.url = new URL(media.url, this._hass.hassUrl ? this._hass.hassUrl() : location.origin).href;
    } catch (err) {
      this._stop();
      this._rec.note = this._t("play_failed", { err: err.message || String(err) });
    }
    if (this._view === "rec") this._fillPlayer();
  }

  _video() {
    const player = this._player;
    if (!player) return null;
    return player.tagName === "VIDEO"
      ? player
      : player.shadowRoot && player.shadowRoot.querySelector("video");
  }

  _togglePause() {
    const rec = this._rec;
    if (rec.at == null) return;
    if (rec.paused) {
      // The stream kept running while paused, so resuming asks for that moment again.
      this._playAt(rec.cursor);
      return;
    }
    rec.paused = true;
    const video = this._video();
    if (video) video.pause();
    this._syncControls(rec.cursor);
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
    if (video && !video.dataset.fit && video.videoWidth) {
      video.dataset.fit = "1";
      // The DVR records 1080N: half the columns of a 16:9 picture, to be shown stretched.
      if (video.videoWidth < video.videoHeight) {
        Object.assign(video.style, { width: "100%", height: "100%", maxHeight: "none", objectFit: "fill" });
      }
    }
    if (this._isToday() && Date.now() - (this._refreshed || 0) > 120000) this._refreshRanges();
    if (this._seeking || rec.paused) return;
    if (video && rec.at != null) {
      rec.cursor = rec.at + (video.currentTime || 0);
      const done = video.ended || (video.currentTime || 0) >= WINDOW - 2;
      if (done && rec.at + WINDOW < DAY) {
        this._playAt(rec.at + WINDOW);
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
    const frame = parts.frame;
    this._player = null;
    const camera = rec.at == null && !rec.note && this._isToday()
      ? this._channelCamera(rec.channel) : null;
    frame.className = camera ? "player live" : "player";
    frame.replaceChildren();
    if (camera) {
      const badge = document.createElement("div");
      badge.className = "badge";
      badge.textContent = this._t("live");
      frame.append(this._liveHolder(camera), badge);
    } else if (rec.url) {
      this._recLive = null;
      // Safari plays HLS by itself; everywhere else Home Assistant's player does.
      const own = customElements.get("ha-hls-player");
      const player = document.createElement(own ? "ha-hls-player" : "video");
      player.className = "video";
      if (own) {
        player.hass = this._hass;
        player.url = rec.url;
      } else {
        player.src = rec.url;
      }
      player.controls = false;
      player.autoPlay = true;
      player.autoplay = true;
      player.muted = true;
      player.playsInline = true;
      player.playsinline = true;
      this._player = player;
      frame.append(player);
    } else {
      this._recLive = null;
      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = rec.note || rec.error || (rec.at != null
        ? this._t("starting")
        : rec.ranges === null
          ? this._t("loading")
          : rec.ranges.length ? this._t("pick_time") : this._t("no_recordings_day"));
      frame.append(hint);
    }
    this._syncControls();
  }

  _renderTimeline(card) {
    const rec = this._rec;
    const box = document.createElement("div");
    box.className = "rec";
    card.append(box);

    const frame = document.createElement("div");
    frame.className = "player";

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
    transport.append(
      left,
      this._button("mdi:rewind-60", this._t("back_1m"), () => jump(-60), { text: false, cls: "round" }),
      pause,
      this._button("mdi:fast-forward-60", this._t("fwd_1m"), () => jump(60), { text: false, cls: "round" }),
      right);

    box.append(frame, chips, nav, now, timeline, transport);
    this._parts = { frame, now, scroll, track, span, pause, live };
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
