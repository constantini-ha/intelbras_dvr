import { t, tn } from "./i18n.js";

const PLATFORM = "intelbras_dvr";
const ROOT = "media-source://intelbras_dvr";

const STYLE = `
  :host { display:block }
  ha-card { overflow:hidden; display:flex; flex-direction:column }
  :host(.full) { position:fixed; inset:0; z-index:9999 }
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
  .crumb { padding:10px 14px 4px; font-size:13px; color:var(--secondary-text-color) }
  .list { display:grid; grid-template-columns:repeat(auto-fill, minmax(132px, 1fr)); gap:8px;
    padding:8px 12px 14px; overflow:auto }
  .list button { all:unset; cursor:pointer; box-sizing:border-box; display:flex; align-items:center;
    gap:8px; min-height:44px; padding:0 12px; border-radius:12px; font-size:14px;
    background:var(--secondary-background-color); color:var(--primary-text-color);
    --mdc-icon-size:20px }
  .list button:hover, .list button:focus-visible {
    background:color-mix(in srgb, var(--primary-color) 16%, var(--secondary-background-color)) }
  .list button.on { background:var(--primary-color); color:var(--text-primary-color) }
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
    this._trail = [];
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
    if (this._player && "hass" in this._player) this._player.hass = hass;
    // A camera that shows up later (the DVR loaded after the page) joins the grid.
    if (this._view === "live" && this._cameras().join() !== this._shown) this._render();
  }

  connectedCallback() {
    this._onFull = () => this._syncFullButton();
    document.addEventListener("fullscreenchange", this._onFull);
  }

  disconnectedCallback() {
    document.removeEventListener("fullscreenchange", this._onFull);
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
      this.classList.remove("full");
    } else if (this.requestFullscreen) {
      // iOS has no element fullscreen, so the card covers the window instead.
      await this.requestFullscreen().catch(() => this.classList.add("full"));
    } else {
      this.classList.add("full");
    }
    this._syncFullButton();
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
    if (view === "rec" && !this._trail.length) this._open(ROOT);
    this._render();
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

  async _open(mediaId, { replace = false } = {}) {
    this._busy = true;
    this._error = null;
    if (this._view === "rec") this._render();
    try {
      const node = await this._hass.callWS({
        type: "media_source/browse_media",
        media_content_id: mediaId,
      });
      if (replace) this._trail.pop();
      this._trail.push(node);
    } catch (err) {
      this._error = this._t("browse_failed", { err: err.message || String(err) });
    }
    this._busy = false;
    if (this._view === "rec") this._render();
  }

  async _play(item) {
    this._playing = { id: item.media_content_id, title: item.title, url: null };
    this._error = null;
    this._render();
    try {
      const media = await this._hass.callWS({
        type: "media_source/resolve_media",
        media_content_id: item.media_content_id,
      });
      if (!this._playing || this._playing.id !== item.media_content_id) return;
      this._playing.url = media.url;
    } catch (err) {
      this._playing = null;
      this._error = this._t("play_failed", { err: err.message || String(err) });
    }
    this._render();
  }

  _renderRecordings(card) {
    const box = document.createElement("div");
    box.className = "rec";
    card.append(box);

    if (this._playing) {
      const frame = document.createElement("div");
      frame.className = "player";
      if (this._playing.url) {
        // Safari plays HLS by itself; everywhere else Home Assistant's player does.
        const own = customElements.get("ha-hls-player");
        const player = document.createElement(own ? "ha-hls-player" : "video");
        if (own) {
          player.hass = this._hass;
          player.url = this._playing.url;
        } else {
          player.src = this._playing.url;
        }
        player.controls = true;
        player.autoplay = true;
        player.muted = true;
        player.playsInline = true;
        player.playsinline = true;
        this._player = player;
        frame.append(player);
      }
      box.append(frame);
    }

    const node = this._trail[this._trail.length - 1];
    const crumb = document.createElement("div");
    crumb.className = "crumb";
    crumb.textContent = this._trail
      .slice(1)
      .map((step) => step.title)
      .concat(this._playing ? [this._playing.title] : [])
      .join(" › ");
    if (crumb.textContent) box.append(crumb);

    const list = document.createElement("div");
    list.className = "list";
    if (this._trail.length > 1) {
      list.append(this._button("mdi:arrow-left", this._t("back"), () => {
        this._trail.pop();
        this._playing = null;
        this._render();
      }));
    }
    for (const child of (node && node.children) || []) {
      const playing = this._playing && this._playing.id === child.media_content_id;
      list.append(
        this._button(
          child.can_play ? "mdi:play-circle-outline" : "mdi:folder-outline",
          child.title,
          () => (child.can_play ? this._play(child) : this._open(child.media_content_id)),
          { on: playing }
        )
      );
    }
    box.append(list);

    const note = this._error
      ? this._error
      : this._busy
        ? this._t("loading")
        : node && !(node.children || []).length
          ? this._t("empty_folder")
          : null;
    if (note) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = note;
      box.append(empty);
    }
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
