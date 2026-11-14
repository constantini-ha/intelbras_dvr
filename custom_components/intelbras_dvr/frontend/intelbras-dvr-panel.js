import { t } from "./i18n.js";
import "./intelbras-dvr-card.js";

const PLATFORM = "intelbras_dvr";

const STYLE = `
  :host { display:block; min-height:100vh; background:var(--primary-background-color);
    color:var(--primary-text-color) }
  .top { position:sticky; top:0; z-index:2; display:flex; align-items:center; gap:8px;
    height:var(--header-height, 56px); padding:0 12px; box-sizing:border-box;
    background:var(--app-header-background-color, var(--primary-color));
    color:var(--app-header-text-color, #fff) }
  .top h1 { flex:1; margin:0; font-size:20px; font-weight:400; white-space:nowrap;
    overflow:hidden; text-overflow:ellipsis }
  .top button { all:unset; cursor:pointer; display:inline-flex; align-items:center; gap:6px;
    min-height:40px; padding:0 12px; border-radius:20px; font-size:14px; --mdc-icon-size:22px }
  .top button:focus-visible { background:rgba(255,255,255,.16) }
  @media (hover:hover) { .top button:hover { background:rgba(255,255,255,.16) } }
  .top button.icon { padding:0 9px }
  .top button .lbl { display:none }
  @media (min-width:720px) { .top button .lbl { display:inline } }
  main { max-width:1280px; margin:0 auto; padding:16px; box-sizing:border-box;
    display:grid; gap:16px }
  .flash { padding:10px 14px; border-radius:12px; font-size:14px;
    background:color-mix(in srgb, var(--primary-color) 14%, var(--card-background-color)) }
  .flash.bad { background:color-mix(in srgb, var(--error-color) 18%, var(--card-background-color)) }
  ha-card.form { padding:16px; display:grid; gap:12px; max-width:560px }
  ha-card.form h2 { margin:0; font-size:18px; font-weight:500 }
  ha-card.form p { margin:0; font-size:14px; color:var(--secondary-text-color) }
  label { display:grid; gap:4px; font-size:13px; color:var(--secondary-text-color) }
  input { font:inherit; font-size:16px; padding:10px 12px; border-radius:10px;
    border:1px solid var(--divider-color); background:var(--secondary-background-color);
    color:var(--primary-text-color) }
  input:focus-visible { outline:2px solid var(--primary-color); outline-offset:1px }
  .row { display:flex; gap:8px; justify-content:flex-end }
  .row button { all:unset; cursor:pointer; min-height:40px; padding:0 18px; border-radius:20px;
    font-size:14px; font-weight:500 }
  .row button.go { background:var(--primary-color); color:var(--text-primary-color) }
  .row button[disabled] { opacity:.5; cursor:default }
  .row button:focus-visible { outline:2px solid var(--primary-color); outline-offset:2px }
  .last { font-size:13px; color:var(--secondary-text-color) }
`;

class IntelbrasDvrPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._settings = false;
    this._form = { host: "", username: "admin", password: "" };
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) this._render();
    const menu = this.shadowRoot.querySelector("ha-menu-button");
    if (menu) menu.hass = hass;
    const card = this.shadowRoot.querySelector("intelbras-dvr-card");
    if (card) card.hass = hass;
    const last = this.shadowRoot.querySelector(".last");
    if (last) last.textContent = this._lastResult();
  }

  set narrow(value) {
    this._narrow = value;
    const menu = this.shadowRoot.querySelector("ha-menu-button");
    if (menu) menu.narrow = value;
  }

  _t(key, vars) {
    return t(this._hass, key, vars);
  }

  _host() {
    const registry = this._hass.entities || {};
    const camera = Object.values(registry).find(
      (e) => e.platform === PLATFORM && e.entity_id.startsWith("camera."));
    const device = camera && (this._hass.devices || {})[camera.device_id];
    const url = device && device.configuration_url;
    return url ? url.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : "";
  }

  _lastResult() {
    const registry = this._hass.entities || {};
    const sensor = Object.values(registry).find(
      (e) => e.platform === PLATFORM && e.entity_id.startsWith("sensor."));
    const state = sensor && this._hass.states[sensor.entity_id];
    return state ? `${this._t("last_result")}: ${state.state}` : "";
  }

  async _toDashboard() {
    try {
      const config = await this._hass.callWS({ type: "lovelace/config", url_path: null });
      const card = { type: "custom:intelbras-dvr-card", columns: 2 };
      const view = config.views[0];
      if (view.sections) view.sections.push({ type: "grid", cards: [card] });
      else (view.cards ||= []).push(card);
      await this._hass.callWS({ type: "lovelace/config/save", url_path: null, config });
      this._flash = { text: this._t("sent_to_dashboard") };
    } catch (err) {
      this._flash = {
        bad: true,
        text: this._t("dashboard_failed", { err: err.message || String(err) }),
      };
    }
    this._render();
  }

  async _apply() {
    this._working = true;
    this._flash = { text: this._t("applying") };
    this._render();
    try {
      await this._hass.callService(PLATFORM, "apply_credentials", { ...this._form });
      this._flash = { text: this._t("applied") };
      this._form.password = "";
      this._settings = false;
    } catch (err) {
      this._flash = {
        bad: true,
        text: this._t("apply_failed", { err: err.message || String(err) }),
      };
    }
    this._working = false;
    this._render();
  }

  _topButton(icon, label, onClick, iconOnly) {
    const button = document.createElement("button");
    if (iconOnly) button.className = "icon";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.innerHTML = `<ha-icon icon="${icon}"></ha-icon>${iconOnly ? "" : '<span class="lbl"></span>'}`;
    if (!iconOnly) button.querySelector(".lbl").textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  _render() {
    const root = this.shadowRoot;
    // The card is kept across renders so the live streams do not restart.
    const card = root.querySelector("intelbras-dvr-card") ||
      document.createElement("intelbras-dvr-card");
    root.innerHTML = "";
    const style = document.createElement("style");
    style.textContent = STYLE;

    const top = document.createElement("div");
    top.className = "top";
    const menu = document.createElement("ha-menu-button");
    menu.hass = this._hass;
    menu.narrow = this._narrow;
    const title = document.createElement("h1");
    title.textContent = this._t("cameras");
    top.append(menu, title);
    const admin = this._hass.user && this._hass.user.is_admin;
    if (admin) {
      top.append(
        this._topButton("mdi:view-dashboard-outline", this._t("add_to_dashboard"),
          () => this._toDashboard()),
        this._topButton("mdi:cog-outline", this._t("settings"), () => {
          this._settings = !this._settings;
          if (this._settings && !this._form.host) this._form.host = this._host();
          this._flash = null;
          this._render();
        }, true)
      );
    }

    const main = document.createElement("main");
    if (this._flash) {
      const flash = document.createElement("div");
      flash.className = this._flash.bad ? "flash bad" : "flash";
      flash.setAttribute("role", "status");
      flash.textContent = this._flash.text;
      main.append(flash);
    }
    if (this._settings && admin) main.append(this._settingsForm());
    if (!card._config) card.setConfig({ columns: 2, default_view: "timeline" });
    card.hass = this._hass;
    main.append(card);
    root.append(style, top, main);
  }

  _settingsForm() {
    const form = document.createElement("ha-card");
    form.className = "form";
    const heading = document.createElement("h2");
    heading.textContent = this._t("credentials");
    const hint = document.createElement("p");
    hint.textContent = this._t("credentials_hint");
    form.append(heading, hint);
    for (const [field, type] of [["host", "text"], ["username", "text"], ["password", "password"]]) {
      const label = document.createElement("label");
      label.textContent = this._t(field);
      const input = document.createElement("input");
      input.type = type;
      input.value = this._form[field];
      input.autocomplete = field === "password" ? "new-password" : "off";
      input.addEventListener("input", () => {
        this._form[field] = input.value;
        go.disabled = !this._ready();
      });
      label.append(input);
      form.append(label);
    }
    const last = document.createElement("div");
    last.className = "last";
    last.textContent = this._lastResult();
    const row = document.createElement("div");
    row.className = "row";
    const close = document.createElement("button");
    close.textContent = this._t("close");
    close.addEventListener("click", () => {
      this._settings = false;
      this._render();
    });
    const go = document.createElement("button");
    go.className = "go";
    go.textContent = this._t("apply");
    go.disabled = !this._ready();
    go.addEventListener("click", () => this._apply());
    row.append(close, go);
    form.append(last, row);
    return form;
  }

  _ready() {
    return !this._working && this._form.host && this._form.username && this._form.password;
  }
}

customElements.define("intelbras-dvr-panel", IntelbrasDvrPanel);
