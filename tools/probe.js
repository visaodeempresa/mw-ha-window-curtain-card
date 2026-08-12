/* Probe headless — instancia o card e o editor fora do navegador.
 * Pega erro de template, SVG quebrado e campo sumido do editor sem depender
 * do HA. Roda no CI e antes de qualquer PR:  node tools/probe.js
 */
"use strict";
const fs = require("fs");
const path = require("path");

const mkEl = () => {
  const el = {
    style: { cssText: "", setProperty() {}, removeProperty() {} },
    dataset: {}, classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
    children: [], innerHTML: "", textContent: "", value: "",
    setAttribute() {}, getAttribute: () => null, removeAttribute() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    appendChild(c) { el.children.push(c); return c; }, remove() {},
    querySelector: () => mkEl(), querySelectorAll: () => [],
    closest: () => null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    parentElement: { style: {} },
  };
  return el;
};

const shadowOf = (host) => ({
  innerHTML: "",
  querySelector(sel) { return host.__q(sel); },
  querySelectorAll() { return []; },
});

global.HTMLElement = class {
  constructor() { this.children = []; this.innerHTML = ""; this.style = { opacity: "" }; }
  attachShadow() { this.shadowRoot = shadowOf(this); return this.shadowRoot; }
  __q() { return mkEl(); }
  appendChild(c) { this.children.push(c); return c; }
  querySelector() { return mkEl(); }
  querySelectorAll() { return []; }
  addEventListener() {} removeEventListener() {} dispatchEvent() {}
  setAttribute() {} getAttribute() { return null; }
};

const reg = {};
global.customElements = { define: (n, c) => (reg[n] = c) };
global.document = {
  createElement: () => mkEl(),
  createElementNS: () => mkEl(),
};
global.window = { customCards: [], addEventListener() {}, removeEventListener() {} };
global.CustomEvent = class { constructor(t, d) { this.type = t; Object.assign(this, d || {}); } };
global.IntersectionObserver = class { observe() {} disconnect() {} };
console.info = () => {};

const src = fs.readFileSync(path.join(__dirname, "..", "dist", "mw-window-curtain-card.js"), "utf8");
eval(src);

/* ------------------------------- cenário ------------------------------- */

const cover = (pos, state) => ({
  state: state || (pos > 0 ? "open" : "closed"),
  attributes: { current_position: pos, friendly_name: "🟧🪟 JANELA DA SALA" },
  last_changed: new Date().toISOString(),
});
const sensor = (v, dc, unit) => ({
  state: String(v), attributes: { device_class: dc, unit_of_measurement: unit, friendly_name: dc },
  last_changed: new Date().toISOString(),
});

const hass = {
  states: {
    "cover.janela_esquerda_da_sala": cover(50),
    "cover.janela_direita_da_sala": cover(50),
    "cover.cortina_da_sala": cover(0),
    "cover.blackout_da_sala": cover(0),
    "binary_sensor.janela_esquerda_da_sala": { state: "on", attributes: { device_class: "window" } },
    "binary_sensor.janela_direita_da_sala": { state: "off", attributes: { device_class: "window" } },
    "sensor.temperatura_da_janela_da_sala": sensor(22.9, "temperature", "°C"),
    "sensor.umidade_da_janela_da_sala": sensor(48.5, "humidity", "%"),
    "sensor.bateria_da_janela_da_sala": sensor(87, "battery", "%"),
    "fan.exaustor_da_sala": { state: "on", attributes: {} },
    "switch.tomada_da_janela": { state: "off", attributes: {} },
    "sun.sun": { state: "above_horizon", attributes: { elevation: 34 } },
    "climate.ar_da_sala": { state: "cool", attributes: {} },
  },
  entities: {
    "cover.janela_esquerda_da_sala": { device_id: "d1", area_id: "sala" },
    "cover.cortina_da_sala": { device_id: "d2", area_id: "sala" },
    "sensor.temperatura_da_janela_da_sala": { device_id: "d3", area_id: "sala" },
    "sensor.bateria_da_janela_da_sala": { device_id: "d3", area_id: "sala" },
  },
  devices: { d1: { name: "Janela", area_id: "sala" }, d2: {}, d3: {} },
  areas: { sala: { area_id: "sala", name: "Sala" } },
  callService() {},
  localize: () => "",
};

let fails = 0;
const ok = (label, cond, extra) => {
  if (cond) { console.log(`  ✓ ${label}`); return; }
  fails++;
  console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`);
};

/* ------------------------------- testes ------------------------------- */

console.log("card:");
const Card = reg["mw-window-curtain-card"];
ok("registrado", !!Card);

const el = new Card();
el.setConfig({
  panes: 4, slide: "out",
  opener: "cover.janela_esquerda_da_sala",
  opener_right: "cover.janela_direita_da_sala",
  curtain: "cover.cortina_da_sala",
  blackout: "cover.blackout_da_sala",
  sensor_left: "binary_sensor.janela_esquerda_da_sala",
  sensor_right: "binary_sensor.janela_direita_da_sala",
  temperature: "sensor.temperatura_da_janela_da_sala",
  humidity: "sensor.umidade_da_janela_da_sala",
  ac_duct: "both", ac_entity: "climate.ar_da_sala",
  accessories: [{ type: "exhaust", entity: "fan.exaustor_da_sala", x: 80, y: 14 }],
});
el.hass = hass;

const html = el.shadowRoot.innerHTML;
ok("desenhou o SVG", html.includes("<svg"), `${html.length} bytes`);
ok("4 folhas de vidro", (html.match(/class="pane /g) || []).length === 4);
ok("duas folhas móveis", html.includes("move m1") && html.includes("move m2"));
ok("cortina de dois panos", html.includes("curtain cl") && html.includes("curtain cr"));
ok("blackout", html.includes("boCloth"));
ok("tubo dos dois lados", html.includes("duct-l") && html.includes("duct-r"));
ok("acessório", html.includes("a-exhaust"));
ok("controles de todos os covers",
  (html.match(/class="ctl"/g) || []).length === 4,
  `achei ${(html.match(/class="ctl"/g) || []).length}`);
ok("escala canônica de clima presente", src.includes("mw-climate-scale v1"));
ok("papel claro e escuro embutidos",
  src.includes("paper-palette v1") && src.includes("paper-dark-palette v1"));
ok("sem gradiente órfão no SVG",
  !/url\(#wc[A-Za-z]+\)/.test(html.replace(/url\(#(wcCloth|wcBo|wcFrame|wcClip|wcLinen|wcJute|wcSkyGrad)\)/g, "")),
  "referência a def inexistente");

// caminho de 2 folhas
const el2 = new Card();
el2.setConfig({ opener: "cover.janela_esquerda_da_sala", curtain: "cover.cortina_da_sala" });
el2.hass = hass;
ok("2 folhas por padrão", (el2.shadowRoot.innerHTML.match(/class="pane /g) || []).length === 2);

// configuração sem nada útil tem de reclamar
let threw = false;
try { new Card().setConfig({ name: "vazio" }); } catch (e) { threw = true; }
ok("recusa configuração vazia", threw);

console.log("\ndescoberta:");
ok("acha a janela pelo ambiente", (() => {
  const g = Card.getStubConfig(hass);
  return g.opener === "cover.janela_esquerda_da_sala" && g.curtain === "cover.cortina_da_sala";
})());

console.log("\neditor:");
const Ed = reg["mw-window-curtain-card-editor"];
ok("registrado", !!Ed);
const ed = new Ed();
ed.setConfig({ opener: "cover.janela_esquerda_da_sala" });
ed.hass = hass;
const { DEFAULTS, LABELS } = module.exports;
const names = [];
const walk = (s) => s.forEach((f) => (f.type === "expandable" ? walk(f.schema) : names.push(f.name)));
const PANES = ["janela", "panos", "clima", "extras", "paisagem", "estilo"];
// alguns campos só aparecem em certas configurações (o 2º empurrador só com 4
// folhas, as imagens só na paisagem por horário) — varrer as variantes é o
// único jeito honesto de saber se um campo tem lugar no editor
for (const variant of [{}, { panes: 4 }, { scenery: "image" }, { scenery: "image_by_time" }]) {
  ed.setConfig({ opener: "cover.janela_esquerda_da_sala", ...variant });
  ed.hass = hass;
  for (const id of PANES) walk(ed._schemaFor(id));
}
const declared = [...new Set(names.filter(Boolean))];
ok("editor cobre 6 abas", declared.length > 30, `${declared.length} campos`);

const semDefault = declared.filter((n) => !(n in DEFAULTS));
ok("todo campo do editor tem default", semDefault.length === 0, semDefault.join(", "));

const semRotulo = declared.filter((n) => !LABELS[n]);
ok("todo campo do editor tem rótulo em pt-BR", semRotulo.length === 0, semRotulo.join(", "));

// Campo com default e sem lugar no editor é campo que só existe no YAML.
// A lista abaixo é a exceção consciente: `area` é do próprio editor, e os
// tons de papel têm grade de amostras clicáveis em vez de campo no ha-form.
const SEM_HA_FORM = ["area", "accessories", "paper", "curtain_paper", "blackout_paper"];
const soYaml = Object.keys(DEFAULTS).filter((n) => !declared.includes(n) && !SEM_HA_FORM.includes(n));
ok("nenhum campo esquecido fora do editor", soYaml.length === 0, soYaml.join(", "));

ed._set("paper", "blue-4");
ok("clique na amostra grava o papel", ed._cfg.paper === "blue-4");
ed._addAcc({ x: 12, y: 40 });
ok("largar no quadro cria acessório",
  ed._cfg.accessories.length === 1 && ed._cfg.accessories[0].x === 12);
ed._updAcc(0, { x: 90, y: 20 });
ok("arrastar o pino move o acessório", ed._cfg.accessories[0].x === 90);

console.log(fails === 0 ? "\ntudo certo." : `\n${fails} problema(s).`);
process.exit(fails === 0 ? 0 : 1);
