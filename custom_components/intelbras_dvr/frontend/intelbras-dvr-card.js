import { t, tn } from "./i18n.js";

const PLATFORM = "intelbras_dvr";
const ROOT = "media-source://intelbras_dvr";
// How much video one request to the DVR covers, in seconds.
const WINDOW = 1800;

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
  .bar button { all:unset; cursor:pointer; display:inline-flex; align-items:center; gap:6px;
    min-height:36px; padding:0 10px; border-radius:18px; font-size:13px;
    color:var(--secondary-text-color); --mdc-icon-size:20px }
  .bar button:hover, .bar button:focus-visible { background:var(--secondary-background-color) }
  .bar button.on { color:var(--primary-color);
    background:color-mix(in srgb, var(--primary-color) 14%, transparent) }
  .bar button.icon { padding:0 8px }
  :host(.full) .bar button:not(.on), :host(:fullscreen) .bar button:not(.on) { color:#fff }
  :host(.full) .bar button:hover, :host(:fullscreen) .bar button:hover { background:rgba(255,255,255,.16) }
  .grid { display:grid; gap:3px; background:#000; flex:1; min-height:0 }
  .cell { position:relative; background:#000; overflow:hidden; min-width:0; min-height:72px }
  .cell > .stream > * { display:block; --ha-card-border-radius:0;
    --ha-card-border-width:0; --ha-card-box-shadow:none; --ha-card-background:#000 }
  .cell .tap { all:unset; position:absolute; inset:0; cursor:pointer }
  .cell .tap:focus-visible { outline:2px solid var(--primary-color); outline-offset:-2px }
  .cell .name { position:absolute; right:8px; bottom:8px; padding:2px 8px; border-radius:10px;
    background:rgba(0,0,0,.55); color:#fff; font-size:12px; pointer-events:none }
  .grid.focus { display:flex; align-items:center; justify-content:center }
  .grid.focus .cell { display:none }
  .grid.focus .cell.sel { display:block; width:100% }
  .grid.focus .name { display:none }
  :host(.full) .grid.focus .cell.sel, :host(:fullscreen) .grid.focus .cell.sel {
    width:min(100%, calc((100vh - 56px) * var(--ratio, 1.5))) }
  :host(.full) .grid:not(.focus), :host(:fullscreen) .grid:not(.focus) { align-content:center }
  .empty { padding:24px 16px; color:var(--secondary-text-color); text-align:center }
  .rec { display:flex; flex-direction:column; min-height:0; flex:1; background:var(--card-background-color) }
  .player { background:#000; aspect-ratio:16/9; max-height:70vh }
  .player > * { display:block; width:100%; height:100% }
  .player { position:relative }
  .player.live { aspect-ratio:auto; max-height:none; min-height:72px }
  .player.live > .stream { height:auto }
  .player.live > .stream > * { display:block; --ha-card-border-radius:0;
    --ha-card-border-width:0; --ha-card-box-shadow:none; --ha-card-background:#000 }
  .badge { position:absolute; left:8px; top:8px; width:auto; height:auto; padding:2px 8px;
    border-radius:10px; background:rgba(0,0,0,.55); color:#fff; font-size:12px; pointer-events:none }
  .tip { padding:8px 14px 0; font-size:13px; color:var(--secondary-text-color) }
  .hint { position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
    padding:16px; text-align:center; color:rgba(255,255,255,.78); font-size:14px }
  .chips, .nav { display:flex; align-items:center; gap:6px; padding:8px 12px 0; flex-wrap:wrap }
  .chips button, .nav button { all:unset; cursor:pointer; display:inline-flex; align-items:center;
    gap:6px; min-height:36px; padding:0 12px; border-radius:18px; font-size:13px;
    background:var(--secondary-background-color); color:var(--primary-text-color);
    --mdc-icon-size:20px }
  .nav button { padding:0 8px }
  .chips button.on { background:var(--primary-color); color:var(--text-primary-color) }
  .chips button:focus-visible, .nav button:focus-visible, .nav input:focus-visible {
    outline:2px solid var(--primary-color); outline-offset:1px }
  .nav button[disabled] { opacity:.4; cursor:default }
  .nav input { font:inherit; font-size:14px; min-height:36px; padding:0 8px; border-radius:10px;
    border:1px solid var(--divider-color); background:var(--secondary-background-color);
    color:var(--primary-text-color); color-scheme:light dark }
  .now { flex:1; min-width:76px; text-align:center; font-size:16px; font-weight:500;
    font-variant-numeric:tabular-nums; color:var(--primary-text-color) }
  .scroll { overflow-x:auto; margin:10px 12px 14px; border-radius:10px;
    background:var(--secondary-background-color) }
  .track { position:relative; height:64px; min-width:100%; cursor:pointer }
  .hour { position:absolute; top:0; bottom:0; padding:4px 0 0 4px; font-size:10px;
    color:var(--secondary-text-color); border-left:1px solid var(--divider-color);
    white-space:nowrap; pointer-events:none }
  .hour.quiet { color:transparent }
  .block { position:absolute; top:26px; height:26px; min-width:1px; border-radius:2px;
    background:var(--primary-color); opacity:.85; pointer-events:none }
  .cursor { position:absolute; top:0; bottom:0; width:2px; margin-left:-1px;
    background:var(--error-color, #db4437); pointer-events:none }
  .cursor[hidden] { display:none }
`;

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
    this._view = "live";
    this._focus = null;
    this._streams = [];
    this._rec = { channel: 1, day: null, ranges: null, zoom: 1, at: null, cursor: null };
  }

  setConfig(config) {
    this._config = { columns: 2, ...config };
    if (this._hass) this._render();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) {
      this._render();
      return;
    }
    for (const card of this._streams) card.hass = hass;
    if (this._recLive && this._recLive.card) this._recLive.card.hass = hass;
    if (this._player && "hass" in this._player) this._player.hass = hass;
    // A camera that shows up later (the DVR loaded after the page) joins the grid.
    if (this._view === "live" && this._cameras().join() !== this._shown) this._render();
  }

  connectedCallback() {
    this._onFull = () => this._syncFullButton();
    document.addEventListener("fullscreenchange", this._onFull);
    this._onKey = (ev) => {
      if (ev.key === "Escape" && this.classList.contains("full")) this._toggleFull();
    };
    document.addEventListener("keydown", this._onKey);
  }

  disconnectedCallback() {
    document.removeEventListener("fullscreenchange", this._onFull);
    document.removeEventListener("keydown", this._onKey);
    clearInterval(this._tick);
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
    button.innerHTML = `<ha-icon icon="${icon}"></ha-icon>${text ? `<span></span>` : ""}`;
    if (text) button.querySelector("span").textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  _render() {
    const root = this.shadowRoot;
    root.innerHTML = "";
    this._streams = [];
    this._player = null;
    const style = document.createElement("style");
    style.textContent = STYLE;
    const card = document.createElement("ha-card");
    root.append(style, card);

    const bar = document.createElement("div");
    bar.className = "bar";
    if (this._view === "live" && this._focus) {
      bar.append(this._button("mdi:arrow-left", this._t("back"), () => {
        this._focus = null;
        this._applyFocus();
      }, { text: false, cls: "backbtn" }));
    }
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = this._config.title || this._t("cameras");
    bar.append(
      title,
      this._button("mdi:cctv", this._t("live"), () => this._show("live"),
        { on: this._view === "live" }),
      this._button("mdi:history", this._t("recordings"), () => this._show("rec"),
        { on: this._view === "rec" }),
      this._button("mdi:fullscreen", this._t("fullscreen"), () => this._toggleFull(),
        { text: false, cls: "fullbtn" })
    );
    card.append(bar);
    this._syncFullButton();

    if (this._view === "live") this._renderLive(card);
    else this._renderRecordings(card);
  }

  _show(view) {
    if (view === this._view) return;
    this._view = view;
    if (view === "rec") {
      this._loadDay();
      return;
    }
    this._stop();
    this._recLive = null;
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

  _channelCamera(channel) {
    const registry = this._hass.entities || {};
    const own = Object.keys(registry)
      .filter((id) => id.startsWith("camera.") && registry[id].platform === PLATFORM &&
        !registry[id].hidden)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return own.find((id) => new RegExp(`\\D${channel}$`).test(id)) || own[channel - 1] || null;
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
    this._grid = grid;

    const helpers = await window.loadCardHelpers();
    if (!grid.isConnected) return;
    for (const entityId of cameras) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.entity = entityId;
      const stream = document.createElement("div");
      stream.className = "stream";
      const live = this._liveCard(helpers, entityId);
      this._streams.push(live);
      stream.append(live);
      const tap = document.createElement("button");
      tap.className = "tap";
      const name = this._name(entityId);
      tap.setAttribute("aria-label", name);
      tap.addEventListener("click", () => {
        // The picture's own shape, so a full screen can fit it by height too.
        const box = cell.getBoundingClientRect();
        if (!this._focus && box.height > 80) cell.style.setProperty("--ratio", box.width / box.height);
        this._focus = this._focus === entityId ? null : entityId;
        this._applyFocus();
      });
      const label = document.createElement("div");
      label.className = "name";
      label.textContent = name;
      cell.append(stream, tap, label);
      grid.append(cell);
    }
    this._applyFocus();
  }

  // Enlarging keeps every stream alive, so going back to the grid is instant.
  _applyFocus() {
    if (!this._grid) return;
    if (this._focus && !this._cameras().includes(this._focus)) this._focus = null;
    this._grid.classList.toggle("focus", !!this._focus);
    for (const cell of this._grid.children) {
      cell.classList.toggle("sel", cell.dataset.entity === this._focus);
    }
    const bar = this.shadowRoot.querySelector(".bar");
    const back = bar.querySelector(".backbtn");
    if (this._focus && !back) {
      bar.prepend(this._button("mdi:arrow-left", this._t("back"), () => {
        this._focus = null;
        this._applyFocus();
      }, { text: false, cls: "backbtn" }));
    } else if (!this._focus && back) {
      back.remove();
    }
    bar.querySelector(".title").textContent = this._focus
      ? this._name(this._focus)
      : this._config.title || this._t("cameras");
  }

  _day(offset = 0) {
    const [y, m, d] = this._rec.day.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + offset));
    return date.toISOString().slice(0, 10);
  }

  async _loadDay(change = {}) {
    this._stop();
    Object.assign(this._rec, change, { ranges: null, error: null, cursor: null });
    this._render();
    const asked = `${this._rec.channel}|${this._rec.day}`;
    try {
      const answer = await this._hass.callWS({
        type: "intelbras_dvr/recordings",
        channel: this._rec.channel,
        ...(this._rec.day ? { day: this._rec.day } : {}),
      });
      if (asked !== `${this._rec.channel}|${this._rec.day}`) return;
      Object.assign(this._rec, {
        entry: answer.entry_id,
        day: answer.day,
        today: answer.today,
        channels: answer.channels,
        ranges: answer.ranges,
      });
    } catch (err) {
      this._rec.ranges = [];
      this._rec.error = this._t("browse_failed", { err: err.message || String(err) });
    }
    if (this._view === "rec") this._render();
  }

  _stop() {
    clearInterval(this._tick);
    this._tick = null;
    this._player = null;
    Object.assign(this._rec, { at: null, url: null, note: null });
  }

  // The DVR plays from an instant, so moving on the timeline starts a new stream there.
  async _playAt(second) {
    const ranges = this._rec.ranges || [];
    const inside = ranges.find(([from, to]) => second >= from && second < to - 2);
    const next = inside ? null : ranges.find(([from]) => from > second);
    if (!inside && !next) {
      this._stop();
      this._rec.note = this._t("no_recording_there");
      this._render();
      return;
    }
    const at = Math.max(0, Math.floor(inside ? second : next[0]));
    this._stop();
    this._recLive = null;
    Object.assign(this._rec, { at, cursor: at });
    this._render();
    const stamp = (value) => {
      const pad = (n) => String(n).padStart(2, "0");
      const clock = Math.min(value, 86399);
      return this._rec.day.replaceAll("-", "") +
        pad(Math.floor(clock / 3600)) + pad(Math.floor((clock % 3600) / 60)) + pad(clock % 60);
    };
    try {
      const media = await this._hass.callWS({
        type: "media_source/resolve_media",
        media_content_id:
          `${ROOT}/PLAY|${this._rec.entry}|${this._rec.channel}|${stamp(at)}|${stamp(at + WINDOW)}`,
      });
      if (this._rec.at !== at) return;
      this._rec.url = media.url;
    } catch (err) {
      this._stop();
      this._rec.note = this._t("play_failed", { err: err.message || String(err) });
    }
    if (this._view === "rec") this._render();
  }

  _video() {
    const player = this._player;
    if (!player) return null;
    return player.tagName === "VIDEO"
      ? player
      : player.shadowRoot && player.shadowRoot.querySelector("video");
  }

  _clock(second) {
    const pad = (n) => String(n).padStart(2, "0");
    const s = Math.max(0, Math.min(86399, Math.floor(second)));
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  }

  _moveCursor() {
    const video = this._video();
    if (video && this._rec.at != null) {
      this._rec.cursor = this._rec.at + (video.currentTime || 0);
      const done = video.ended || (video.currentTime || 0) >= WINDOW - 2;
      if (done && this._rec.at + WINDOW < 86400) {
        this._playAt(this._rec.at + WINDOW);
        return;
      }
    }
    const root = this.shadowRoot;
    const line = root.querySelector(".cursor");
    const now = root.querySelector(".now");
    if (line && this._rec.cursor != null) {
      line.style.left = `${(this._rec.cursor / 86400) * 100}%`;
      line.hidden = false;
    }
    if (now) {
      now.textContent = this._rec.at != null && this._rec.cursor != null
        ? this._clock(this._rec.cursor)
        : this._rec.live ? this._t("live") : "--:--:--";
    }
  }

  _setZoom(zoom) {
    const scroll = this.shadowRoot.querySelector(".scroll");
    const track = this.shadowRoot.querySelector(".track");
    if (!scroll || !track) return;
    // Keep the moment under the middle of the bar in place while the scale changes.
    const anchor = this._rec.cursor != null
      ? this._rec.cursor / 86400
      : (scroll.scrollLeft + scroll.clientWidth / 2) / track.offsetWidth;
    this._rec.zoom = Math.max(1, Math.min(48, zoom));
    track.style.width = `${this._rec.zoom * 100}%`;
    this._labelHours(track);
    scroll.scrollLeft = anchor * track.offsetWidth - scroll.clientWidth / 2;
  }

  _labelHours(track) {
    const perHour = track.offsetWidth / 24;
    const step = perHour >= 46 ? 1 : perHour >= 23 ? 2 : perHour >= 12 ? 4 : 6;
    for (const tick of track.querySelectorAll(".hour")) {
      tick.classList.toggle("quiet", Number(tick.dataset.hour) % step !== 0);
    }
  }

  _renderRecordings(card) {
    const rec = this._rec;
    const box = document.createElement("div");
    box.className = "rec";
    card.append(box);

    const frame = document.createElement("div");
    frame.className = "player";
    const status = rec.note || rec.error || (rec.ranges === null
      ? this._t("loading")
      : rec.ranges.length ? this._t("pick_time") : this._t("no_recordings_day"));
    const camera = rec.at == null ? this._channelCamera(rec.channel) : null;
    rec.live = !!camera;
    if (camera) {
      // Until a moment is picked, the channel shows what is happening now.
      frame.classList.add("live");
      const badge = document.createElement("div");
      badge.className = "badge";
      badge.textContent = this._t("live");
      frame.append(this._liveHolder(camera), badge);
    } else if (rec.url) {
      // Safari plays HLS by itself; everywhere else Home Assistant's player does.
      const own = customElements.get("ha-hls-player");
      const player = document.createElement(own ? "ha-hls-player" : "video");
      if (own) {
        player.hass = this._hass;
        player.url = rec.url;
      } else {
        player.src = rec.url;
      }
      player.controls = true;
      player.autoPlay = true;
      player.autoplay = true;
      player.muted = true;
      player.playsInline = true;
      player.playsinline = true;
      this._player = player;
      frame.append(player);
    } else {
      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = rec.at != null ? this._t("starting") : status;
      frame.append(hint);
    }
    box.append(frame);
    if (camera) {
      const tip = document.createElement("div");
      tip.className = "tip";
      tip.setAttribute("role", "status");
      tip.textContent = status;
      box.append(tip);
    }

    const chips = document.createElement("div");
    chips.className = "chips";
    for (let channel = 1; channel <= (rec.channels || 1); channel += 1) {
      chips.append(this._button("mdi:cctv", this._t("channel", { n: channel }),
        () => channel !== rec.channel && this._loadDay({ channel }),
        { on: channel === rec.channel }));
    }
    box.append(chips);

    const nav = document.createElement("div");
    nav.className = "nav";
    const date = document.createElement("input");
    date.type = "date";
    date.value = rec.day || "";
    date.max = rec.today || "";
    date.setAttribute("aria-label", this._t("date"));
    date.addEventListener("change", () => date.value && this._loadDay({ day: date.value }));
    const now = document.createElement("div");
    now.className = "now";
    const next = this._button("mdi:chevron-right", this._t("next_day"),
      () => this._loadDay({ day: this._day(1) }), { text: false });
    next.disabled = !rec.day || rec.day >= (rec.today || "");
    nav.append(
      this._button("mdi:chevron-left", this._t("prev_day"),
        () => rec.day && this._loadDay({ day: this._day(-1) }), { text: false }),
      date,
      next,
      now,
      ...(rec.at != null ? [this._button("mdi:record-circle-outline", this._t("live"), () => {
        this._stop();
        this._render();
      }, { text: false })] : []),
      this._button("mdi:rewind-60", this._t("back_1m"),
        () => rec.cursor != null && this._playAt(rec.cursor - 60), { text: false }),
      this._button("mdi:fast-forward-60", this._t("fwd_1m"),
        () => rec.cursor != null && this._playAt(rec.cursor + 60), { text: false }),
      this._button("mdi:magnify-minus-outline", this._t("zoom_out"),
        () => this._setZoom(rec.zoom / 2), { text: false }),
      this._button("mdi:magnify-plus-outline", this._t("zoom_in"),
        () => this._setZoom(rec.zoom * 2), { text: false })
    );
    box.append(nav);

    const scroll = document.createElement("div");
    scroll.className = "scroll";
    const track = document.createElement("div");
    track.className = "track";
    track.style.width = `${rec.zoom * 100}%`;
    for (let hour = 0; hour < 24; hour += 1) {
      const tick = document.createElement("div");
      tick.className = "hour";
      tick.dataset.hour = hour;
      tick.style.left = `${(hour / 24) * 100}%`;
      tick.textContent = `${String(hour).padStart(2, "0")}:00`;
      track.append(tick);
    }
    for (const [from, to] of rec.ranges || []) {
      const block = document.createElement("div");
      block.className = "block";
      block.style.left = `${(from / 86400) * 100}%`;
      block.style.width = `${((to - from) / 86400) * 100}%`;
      track.append(block);
    }
    const line = document.createElement("div");
    line.className = "cursor";
    line.hidden = true;
    track.append(line);
    track.addEventListener("click", (ev) => {
      const box = track.getBoundingClientRect();
      this._playAt(((ev.clientX - box.left) / box.width) * 86400);
    });
    scroll.append(track);
    box.append(scroll);

    this._moveCursor();
    // Widths are only real once the browser has laid the new nodes out.
    requestAnimationFrame(() => {
      this._labelHours(track);
      if (rec.cursor != null) {
        scroll.scrollLeft = (rec.cursor / 86400) * track.offsetWidth - scroll.clientWidth / 2;
      }
    });
    clearInterval(this._tick);
    if (rec.url) this._tick = setInterval(() => this._moveCursor(), 1000);
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
