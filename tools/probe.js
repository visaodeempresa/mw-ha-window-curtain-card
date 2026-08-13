/* Probe headless — instancia o card e o editor fora do navegador.
 * Pega erro de template, SVG quebrado e campo sumido do editor sem depender
 * do HA. Roda no CI e antes de qualquer PR:  node tools/probe.js
 */
"use strict";
const fs = require("fs");
const path = require("path");

// `classList` e `style` de verdade: sem eles o probe não consegue afirmar
// nada sobre classe ligada nem sobre variável CSS escrita — que é metade do
// que este card faz.
const mkEl = () => {
  const cls = new Set();
  const props = new Map();
  const el = {
    style: {
      cssText: "",
      setProperty(k, v) { props.set(k, String(v)); },
      getPropertyValue(k) { return props.get(k) ?? ""; },
      removeProperty(k) { props.delete(k); },
    },
    dataset: {},
    classList: {
      add: (...n) => n.forEach((x) => cls.add(x)),
      remove: (...n) => n.forEach((x) => cls.delete(x)),
      contains: (n) => cls.has(n),
      toggle: (n, f) => { const on = f === undefined ? !cls.has(n) : !!f; if (on) cls.add(n); else cls.delete(n); return on; },
    },
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
ok("cortina de dois panos", html.includes("curtain cur-l") && html.includes("curtain cur-r"));
// regressão: `.cl` do pano colidia com `.cl` do rótulo do controle, e o
// rótulo herdava scaleX(var(--cl)) — sumia com a cortina aberta
ok("classe do pano não colide com a do rótulo",
  !/class="curtain cl"/.test(html) && !/class="curtain cr"/.test(html));
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

/* --- melhorias pedidas em 12/08/2026 --- */
const monta = (extra) => {
  const e = new Card();
  e.setConfig({
    opener: "cover.janela_esquerda_da_sala",
    curtain: "cover.cortina_da_sala",
    sensor_left: "binary_sensor.janela_esquerda_da_sala",
    sensor_right: "binary_sensor.janela_direita_da_sala",
    temperature: "sensor.temperatura_da_janela_da_sala",
    humidity: "sensor.umidade_da_janela_da_sala",
    ...extra,
  });
  e.hass = hass;
  return e.shadowRoot.innerHTML;
};

// Sobre a crase solta em comentário dentro do template do _css(): NÃO tem
// teste aqui de propósito. Ela é erro de SINTAXE — o arquivo não carrega, o
// `eval` acima morre antes, e nenhum teste deste arquivo chega a rodar. Quem
// pega é `node --check`, antes e com mensagem melhor. Um teste aqui seria
// consolo falso: nunca falharia.

console.log("\nmelhorias:");
ok("sensor como risco vertical", (() => {
  const h = monta({ sensor_style: "line" });
  return h.includes('class="sl sl-l') && h.includes('class="sl sl-r');
})());
ok("estilo pastilha não desenha risco", !monta({}).includes('class="sl sl-'));
ok("estilo «os dois» tem risco e pastilha", (() => {
  const h = monta({ sensor_style: "both" });
  return h.includes('class="sl sl-l') && h.includes("dot-l");
})());
ok("risco sozinho tira a pastilha do rodapé", !monta({ sensor_style: "line" }).includes("dot-l"));

ok("chips no topo", monta({ chips_position: "header" }).includes("headchips"));
ok("chips como marca d'água", (() => {
  const h = monta({ chips_position: "watermark", watermark_align: "top-right" });
  return h.includes("wmark") && h.includes("wm-top-right");
})());
ok("chips no rodapé por padrão", monta({}).includes('class="foot"'));

ok("confirmação desenha o painel", monta({ confirm_accessory: true }).includes('class="confirm"'));
ok("sem confirmação não há painel", !monta({}).includes('class="confirm"'));

ok("recuo dos controles vai para o CSS", monta({ controls_inset: 21 }).includes("21px"));

ok("cortina maior que o vão", (() => {
  const sem = monta({ curtain_overhang: 0 });
  const com = monta({ curtain_overhang: 20 });
  // com sobra, o pano começa 20 unidades antes do vão (x = 55 - 20 = 35)
  return com.includes("M35,") && !sem.includes("M35,");
})());
ok("cena cresce para caber a cortina comprida", (() => {
  const curta = monta({ curtain_drop: 0 });
  const longa = monta({ curtain_drop: 40, curtain_top: 12, rod_offset: 10 });
  const vb = (h) => (h.match(/viewBox="([^"]+)"/) || [])[1];
  const [, , , h0] = vb(curta).split(" ").map(Number);
  const [, y1, , h1] = vb(longa).split(" ").map(Number);
  // cresce em cima (y negativo) e embaixo (altura maior)
  return h0 === 230 && y1 < 0 && h1 > h0;
})());
ok("proporção da caixa acompanha o viewBox", (() => {
  const h = monta({ curtain_drop: 40, curtain_top: 12, rod_offset: 10 });
  const vb = (h.match(/viewBox="([^"]+)"/) || [])[1].split(" ").map(Number);
  return h.includes(`aspect-ratio:${vb[2]} / ${vb[3]}`);
})());
ok("varão sobe e estica", (() => {
  const h = monta({ rod_offset: 10, rod_extend: 30 });
  return h.includes('class="rod"') && h.includes('x="25"');
})());

ok("arrastar liga a classe da cena", (() => {
  const e = new Card();
  e.setConfig({ opener: "cover.janela_esquerda_da_sala", curtain: "cover.cortina_da_sala",
    drag_target: "curtain" });
  e.hass = hass;
  return e._root.classList.contains("can-drag");
})());
ok("sem alvo de arrasto a cena não fica arrastável", (() => {
  const e = new Card();
  e.setConfig({ opener: "cover.janela_esquerda_da_sala" });
  e.hass = hass;
  return !e._root.classList.contains("can-drag");
})());
ok("arrasto move o desenho sem chamar serviço", (() => {
  const e = new Card();
  let chamou = false;
  e.setConfig({ curtain: "cover.cortina_da_sala", drag_target: "curtain" });
  e.hass = { ...hass, callService: () => { chamou = true; } };
  e._previewPos("cur", 40);
  return e._root.style.getPropertyValue("--cl") === "0.600" && !chamou;
})());

ok("moldura suave tira a cor do papel", (() => {
  const h = monta({ border_style: "soft", border_width: 5, paper: "violet-5", paper_dark: true });
  // violeta escuro tom 5 -> matiz 283, clareada para virar a moldura lilás
  return /border:5px solid hsl\(283,/.test(h);
})());
ok("cor da moldura na mão vence a automática",
  monta({ border_style: "soft", border_color: "#abcdef" }).includes("border:3px solid #abcdef"));
ok("halo só existe no estilo glow", (() => {
  // procurar a ASSINATURA do halo, não "qualquer 0 0 Npx rgba(": a bolinha
  // acesa do acessório também tem uma, e o teste passava por engano
  const halo = /rgba\((?:180,140,230|120,90,170),/;
  return !halo.test(monta({ border_style: "soft" }))
    && halo.test(monta({ border_style: "glow", border_glow: 0.8 }));
})());
ok("hover desligado não deixa transição de sombra",
  !monta({ border_style: "soft" }).includes(":hover{border-color"));
ok("hover ligado só mexe em sombra e borda", (() => {
  const h = monta({ border_style: "glow", hover_glow: true });
  return h.includes(":hover{border-color") && !h.includes("transition:all");
})());
ok("sem borda é sem borda", monta({ border_style: "none" }).includes("border:none"));

ok("fonte e cor entram no CSS", (() => {
  const h = monta({ font_family: "Georgia, serif", font_title: 22, color_title: "#ff0000" });
  return h.includes("font-family:Georgia, serif") && h.includes("font-size:22px")
    && h.includes("#ff0000");
})());

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
const PANES = ["janela", "panos", "clima", "extras", "paisagem", "estilo", "textos"];
// alguns campos só aparecem em certas configurações (o 2º empurrador só com 4
// folhas, as imagens só na paisagem por horário) — varrer as variantes é o
// único jeito honesto de saber se um campo tem lugar no editor
for (const variant of [{}, { panes: 4 }, { scenery: "image" }, { scenery: "image_by_time" },
  { sensor_style: "line" }, { chips_position: "watermark" },
  { border_style: "soft" }, { border_style: "glow" }]) {
  ed.setConfig({ opener: "cover.janela_esquerda_da_sala", ...variant });
  ed.hass = hass;
  for (const id of PANES) walk(ed._schemaFor(id));
}
const declared = [...new Set(names.filter(Boolean))];
ok("editor cobre as 7 abas", declared.length > 60, `${declared.length} campos`);

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
