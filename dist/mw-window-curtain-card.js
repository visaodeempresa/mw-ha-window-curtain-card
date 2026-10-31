/* mw-ha-window-curtain-card — custom:mw-window-curtain-card
 *
 * A janela inteira num card só: esquadria com 2 ou 4 folhas de vidro (as
 * fixas e as que o empurrador movimenta), os dois sensores de abertura, o
 * sensor de temperatura/umidade com bateria, cortina, blackout, exaustor,
 * ventoinha solar, tubo de ar-condicionado, tomadas e a paisagem lá fora —
 * de dia, de noite, com chuva, com calor ou com frio, conforme o que os
 * sensores estão dizendo agora.
 *
 * Desenho: um SVG só, montado UMA vez. Estado do HA vira variável CSS, não
 * innerHTML novo — trocar a posição da cortina não reconstrói a cena, só
 * muda `--cur`. Animação é sempre transform/opacity (compositor), pausa
 * sozinha quando o card sai da tela (IntersectionObserver) e respeita
 * prefers-reduced-motion.
 *
 * JS puro + <ha-form>, arquivo único, sem build.
 * Repo: https://github.com/visaodeempresa/mw-ha-window-curtain-card
 * Releases automáticas: merge na main → bump semântico → tag → HACS.
 */
(() => {
  "use strict";

  /* =====================================================================
   * BLOCOS EMBUTIDOS — fonte canônica em IA/lib/, conferidos por
   * IA/tools/check-embeds.sh. Não edite aqui: edite a fonte e rode --fix.
   * ===================================================================== */

  // >>> paper-palette v1 — fonte canônica: /Volumes/SSD-T1-01/CLAUDE-SSD/IA/lib/paper-palette/paper-palette.js
  // 49 papéis encardidos: 7 matizes do arco-íris × 7 tons (1 = quase branco,
  // 7 = mais encardido). Saturação baixa de propósito — papel descansa a vista.
  const PAPER_HUES = [
    ["red", "Vermelho", 6], ["orange", "Laranja", 27], ["yellow", "Amarelo", 47],
    ["green", "Verde", 96], ["blue", "Azul", 203], ["indigo", "Anil", 236],
    ["violet", "Violeta", 283],
  ];
  const PAPER_TONES = [[97, 6], [96, 9], [94, 12], [92, 15], [90, 18], [88, 21], [85, 24]];
  const PAPER_DEFAULT = "linear-gradient(145deg, #fdfaf3, #e8e3d8)";
  const paperGradient = (key) => {
    const m = /^([a-z]+)-([1-7])$/.exec(String(key || "").trim());
    if (!m) return PAPER_DEFAULT;
    const hue = PAPER_HUES.find((h) => h[0] === m[1]);
    if (!hue) return PAPER_DEFAULT;
    const [l, s] = PAPER_TONES[+m[2] - 1];
    return `linear-gradient(145deg, hsl(${hue[2]}, ${s}%, ${l}%), hsl(${hue[2]}, ${s + 4}%, ${l - 7}%))`;
  };
  const paperOptions = () => [{ value: "paper", label: "Papel original (creme)" }].concat(
    ...PAPER_HUES.map((h) => PAPER_TONES.map((t, i) => ({
      value: `${h[0]}-${i + 1}`,
      label: `${h[1]} · tom ${i + 1}${i === 0 ? " (mais claro)" : i === 6 ? " (mais encardido)" : ""}`,
    }))));
  // <<< paper-palette v1

  // >>> paper-dark-palette v1 — fonte canônica: /Volumes/SSD-T1-01/CLAUDE-SSD/IA/lib/paper-dark-palette/paper-dark-palette.js
  // 49 papéis de noite: as mesmas 7 matizes do paper-palette v1 × 7 tons
  // (1 = papel escuro mais claro, 7 = mais encardido). A saturação sobe mais
  // rápido que na rampa clara porque matiz em luminosidade baixa desaparece.
  const PAPER_DARK_HUES = [
    ["red", "Vermelho", 6], ["orange", "Laranja", 27], ["yellow", "Amarelo", 47],
    ["green", "Verde", 96], ["blue", "Azul", 203], ["indigo", "Anil", 236],
    ["violet", "Violeta", 283],
  ];
  const PAPER_DARK_TONES = [[26, 10], [24, 13], [21, 16], [19, 19], [16, 22], [14, 25], [11, 28]];
  const PAPER_DARK_DEFAULT = "linear-gradient(145deg, #2b2825, #161411)";
  const paperDarkGradient = (key) => {
    const m = /^([a-z]+)-([1-7])$/.exec(String(key || "").trim());
    if (!m) return PAPER_DARK_DEFAULT;
    const hue = PAPER_DARK_HUES.find((h) => h[0] === m[1]);
    if (!hue) return PAPER_DARK_DEFAULT;
    const [l, s] = PAPER_DARK_TONES[+m[2] - 1];
    return `linear-gradient(145deg, hsl(${hue[2]}, ${s}%, ${l}%), hsl(${hue[2]}, ${s + 6}%, ${Math.max(4, l - 6)}%))`;
  };
  const paperDarkOptions = () => [{ value: "paper", label: "Papel de noite (grafite)" }].concat(
    ...PAPER_DARK_HUES.map((h) => PAPER_DARK_TONES.map((t, i) => ({
      value: `${h[0]}-${i + 1}`,
      label: `${h[1]} · tom ${i + 1}${i === 0 ? " (mais claro)" : i === 6 ? " (mais escuro)" : ""}`,
    }))));
  // Tinta que se lê sobre o papel do modo pedido. Não é contraste calculado:
  // é o par fixo que a casa usa, para dois cards lado a lado combinarem.
  const paperInk = (dark) => (dark
    ? { text: "rgba(247, 244, 236, 0.94)", dim: "rgba(247, 244, 236, 0.62)", line: "rgba(255, 255, 255, 0.14)" }
    : { text: "rgba(28, 25, 20, 0.92)", dim: "rgba(28, 25, 20, 0.58)", line: "rgba(0, 0, 0, 0.14)" });
  // <<< paper-dark-palette v1


  // >>> paper-grafite-palette v1 — fonte canônica: /Volumes/SSD-T1-01/CLAUDE-SSD/IA/lib/paper-grafite-palette/paper-grafite-palette.js
  // 7 tons de grafite (1 = mais claro, 7 = mais encardido). Matiz 30° da
  // casa, saturação 6–13%: neutro de propósito — grafite não é colorido.
  // A saturação sobe devagar com a escuridão, mas JAMAIS alcança a escala
  // das matizes encardidas (que sobe a 28%): a linha grafite é neutra.
  const GRAFITE_HUE = 30;
  const GRAFITE_TONES = [[26, 6], [22, 7], [19, 8], [16, 9], [13, 10], [10, 12], [8, 13]];
  const GRAFITE_DEFAULT = "linear-gradient(145deg, #2b2825, #161411)";
  const GRAFITE_INK = "rgba(247, 244, 236, 0.94)";
  const isGrafite = (key) => /^grafite-[1-7]$/.test(String(key || "").trim());
  const grafiteGradient = (key) => {
    const m = isGrafite(key) && /^grafite-([1-7])$/.exec(String(key).trim());
    if (!m) return GRAFITE_DEFAULT;
    const [l, s] = GRAFITE_TONES[+m[1] - 1];
    return `linear-gradient(145deg, hsl(${GRAFITE_HUE}, ${s}%, ${l}%), hsl(${GRAFITE_HUE}, ${s + 4}%, ${Math.max(4, l - 6)}%))`;
  };
  const grafiteStops = (key) => {
    const m = isGrafite(key) && /^grafite-([1-7])$/.exec(String(key).trim());
    if (!m) return ["#2b2825", "#161411"];
    const [l, s] = GRAFITE_TONES[+m[1] - 1];
    return [`hsl(${GRAFITE_HUE}, ${s}%, ${l}%)`, `hsl(${GRAFITE_HUE}, ${s + 4}%, ${Math.max(4, l - 6)}%)`];
  };
  const grafiteOptions = () => GRAFITE_TONES.map((t, i) => ({
    value: `grafite-${i + 1}`,
    label: `Grafite · tom ${i + 1}${i === 0 ? " (mais claro)" : i === 6 ? " (mais encardido)" : ""}`,
  }));
  // <<< paper-grafite-palette v1


  // >>> mw-climate-scale v1 — fonte canônica: /Volumes/SSD-T1-01/CLAUDE-SSD/IA/lib/mw-climate-scale/mw-climate-scale.js
  // Escala canônica de cor por temperatura (°C) e umidade relativa (%).
  // Regra: IA/rules/global/40-cores-de-temperatura-e-umidade.md.
  const MW_CLIMATE_SCALE_ALPHA = 0.5;

  // 19 limites superiores inclusivos → 20 cores (a última vale de 46 °C para cima).
  const MW_TEMP_STOPS = [
    3.99, 6.99, 8.99, 13.99, 15.99, 17.99, 18.99, 20.99, 21.99, 22.99,
    23.99, 24.99, 25.99, 26.99, 29.99, 32.99, 35.99, 39.99, 45.99,
  ];
  const MW_TEMP_RGB = (
    "0,0,0 0,0,139 0,0,255 70,130,180 0,206,209 64,224,208 0,255,255 144,238,144 0,255,0 50,205,50 " +
    "127,255,0 154,205,50 255,255,0 255,215,0 255,165,0 255,99,71 255,69,0 178,34,34 139,0,0 139,0,0"
  ).split(" ");

  // Uma faixa por ponto percentual: índice n cobre [n, n+1); 100 é faixa própria.
  // O template original fecha a faixa em n.99 e deixa (n.99, n+1) sem dono — o
  // laço cai no fallback, que é a cor de 100% (preto). Sensor que reporte
  // 58,995 % pisca preto. Aqui o vão é fechado de propósito.
  const MW_HUM_RGB = (
    "0,0,0 51,0,0 102,0,0 153,0,0 204,0,0 255,0,0 255,11,0 255,22,0 255,33,0 255,45,0 " +
    "255,56,0 255,67,0 255,78,0 255,89,0 255,100,0 255,111,0 255,122,0 255,133,0 255,144,0 255,155,0 " +
    "255,165,0 255,170,0 255,174,0 255,179,0 255,183,0 255,188,0 255,192,0 255,197,0 255,201,0 255,206,0 " +
    "255,210,0 255,215,0 255,219,0 255,224,0 255,228,0 255,233,0 255,237,0 255,242,0 255,246,0 255,251,0 " +
    "255,255,0 170,255,85 85,255,170 0,255,255 12,252,253 24,249,251 36,246,249 48,243,247 60,240,245 72,237,243 " +
    "84,234,241 96,231,239 108,228,237 120,225,235 132,222,234 144,219,231 156,216,229 173,216,230 115,144,238 58,72,246 " +
    "0,0,255 0,0,249 0,0,243 0,0,237 0,0,231 0,0,225 0,0,219 0,0,213 0,0,207 0,0,201 " +
    "0,0,195 0,0,189 0,0,183 0,0,177 0,0,171 0,0,165 0,0,159 0,0,153 0,0,147 0,0,141 " +
    "0,0,139 0,0,132 0,0,125 0,0,118 0,0,111 0,0,104 0,0,97 0,0,90 0,0,83 0,0,76 " +
    "0,0,69 0,0,62 0,0,55 0,0,48 0,0,41 0,0,34 0,0,27 0,0,20 0,0,13 0,0,6 " +
    "0,0,0"
  ).split(" ");
  const MW_HUM_STOPS = MW_HUM_RGB.slice(1).map((_, i) => i + 0.99);

  const mwClimateRgba = (triplet, alpha) => `rgba(${triplet.split(",").join(", ")}, ${alpha})`;

  // Faixas + cores no formato do algoritmo de faixa comum: a cor é a primeira
  // cujo limite superior não foi ultrapassado. `clamp` existe porque umidade
  // fora de 0..100 é ruído de sensor, não frio.
  const mwClimateScale = (kind, alpha) => {
    const a = Number.isFinite(Number(alpha)) ? Number(alpha) : MW_CLIMATE_SCALE_ALPHA;
    const hum = kind === "hum" || kind === "humidity" || kind === "umidade";
    return {
      stops: hum ? MW_HUM_STOPS : MW_TEMP_STOPS,
      colors: (hum ? MW_HUM_RGB : MW_TEMP_RGB).map((t) => mwClimateRgba(t, a)),
      clamp: hum ? [0, 100] : null,
    };
  };

  // Cor seca (sem degradê), do jeito que o button-card faz.
  const mwClimateColor = (kind, value, alpha) => {
    const s = mwClimateScale(kind, alpha);
    let v = Number(value);
    if (!Number.isFinite(v)) return null;
    if (s.clamp) v = Math.min(s.clamp[1], Math.max(s.clamp[0], v));
    const i = s.stops.findIndex((stop) => v <= stop);
    return s.colors[i === -1 ? s.stops.length : i];
  };
  // <<< mw-climate-scale v1

  /* ===================== configuração padrão ===================== */

  const DEFAULTS = {
    // --- identidade ---
    name: "",                    // vazio = nome do primeiro cover
    area: "",                    // usado só pelo editor, para o preenchimento automático
    show_header: true,
    show_summary: true,

    // --- esquadria ---
    panes: 2,                    // 2 | 4
    slide: "left",               // left | right | out (4 folhas: as centrais para os lados)
    opener: "",                  // empurrador (cover) da folha móvel principal
    opener_right: "",            // 2º empurrador — a janela da sala tem duas folhas móveis
    invert_position: false,      // cover que reporta 0 = aberto

    // --- sensores de abertura ---
    sensor_left: "",
    sensor_right: "",
    sensor_invert: false,
    // pills = as duas pastilhas do rodapé · line = um risco vertical na borda
    // do vão, verde/vermelho · both = os dois
    sensor_style: "pills",
    sensor_line_width: 5,
    sensor_line_inset: 0,

    // --- clima ---
    temperature: "",
    humidity: "",
    battery: "",
    battery_auto: true,
    show_footer: true,

    // --- cortina ---
    curtain: "",
    curtain_open_from: "sides",  // sides | left | right
    curtain_texture: "paper",    // paper | linho | veludo | voil | juta | seda
    curtain_paper: "",           // vazio = usa o papel do card
    curtain_dark: false,
    curtain_rod: true,
    // Cortina de verdade cobre mais que o vão: sobra dos lados, sobe acima do
    // vão e desce abaixo dele. Tudo em unidades do desenho (o vão tem 250 de
    // largura por 166 de altura), então 12 é "um palmo".
    curtain_overhang: 0,         // quanto passa de cada lado
    curtain_top: 0,              // quanto começa acima do vão
    curtain_drop: 0,             // quanto desce abaixo do vão
    rod_offset: 0,               // sobe o varão
    rod_extend: 12,              // quanto o varão passa de cada lado
    rod_thickness: 4.5,

    // --- blackout ---
    blackout: "",
    blackout_paper: "indigo-6",
    blackout_dark: true,

    // --- acessórios ---
    ac_duct: "none",             // none | left | right | both
    ac_entity: "",
    accessories: [],             // [{type,entity,x,y,size,label}]

    // --- paisagem ---
    scenery: "painted",          // none | painted | image | image_by_time
    scenery_image: "",
    scenery_image_dawn: "",
    scenery_image_day: "",
    scenery_image_dusk: "",
    scenery_image_night: "",
    scenery_skyline: "cidade",   // cidade | morros | mar | campo | nenhum
    badges: "auto",              // none | temp | humidity | both | auto
    sun_entity: "sun.sun",
    weather_entity: "",

    // --- efeitos ---
    animate: true,
    fx: "auto",                  // none | auto | rain | hot | cold | dew
    fx_hot: 30,
    fx_cold: 15,
    fx_rain: 78,
    fx_dew: 62,

    // --- aparência ---
    paper: "paper",
    paper_dark: false,
    depth: "3d",                 // flat | soft | 3d
    // hairline = o fio discreto de sempre · soft = moldura clara acompanhando
    // o canto · glow = moldura + halo colorido. A moldura é pintada uma vez;
    // quem custa caro é blur e sombra animada, que ficam de fora de propósito.
    border_style: "hairline",    // none | hairline | soft | glow
    border_width: 3,
    border_color: "",            // vazio = tirada do próprio tom de papel
    border_glow: 0.35,
    hover_glow: false,           // acende no hover (desktop); custa repintura
    frame_tone: "auto",          // auto | claro | escuro | branco | madeira | aluminio
    radius_tl: 12, radius_tr: 12, radius_br: 12, radius_bl: 12,
    scene_height: 300,
    padding: 10,

    // --- controles ---
    controls: "auto",            // none | auto | compact | full
    control_labels: true,
    controls_inset: 6,           // recuo lateral, para o ícone não bater na curva

    // --- chips de clima ---
    // footer = rodapé (como sempre foi) · header = no topo, junto dos emojis
    // watermark = marca d'água grande sobre o vidro
    chips_position: "footer",
    watermark_opacity: 0.55,
    watermark_align: "bottom-left",  // canto onde a marca d'água se apoia

    // --- textos ---
    font_family: "",             // vazio = a fonte do tema
    font_title: 13, color_title: "",
    font_summary: 11, color_summary: "",
    font_chip: 11, color_chip: "",
    font_control: 11, color_control: "",
    font_percent: 11, color_percent: "",
    font_accessory: 9, color_accessory: "",
    font_watermark: 26, color_watermark: "",
    font_badge: 15,

    // --- ações ---
    tap_action: "more-info",
    hold_action: "none",
    navigation_path: "",
    // arrastar a cena move a folha/cortina/blackout com o dedo
    drag_target: "none",         // none | opener | opener_right | curtain | blackout
    confirm_accessory: false,    // acessório pergunta antes de acionar
  };

  /* ============================ utilidades ============================ */

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const numOr = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

  // pseudoaleatório com semente: as estrelas têm de nascer no mesmo lugar a
  // cada repintura, senão o céu "pisca" de posição a cada atualização do HA
  const seeded = (seed) => {
    let s = seed >>> 0;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  };

  const relTime = (iso) => {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return "";
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 60) return `há ${s}s`;
    if (s < 3600) return `há ${Math.round(s / 60)}min`;
    if (s < 86400) return `há ${Math.round(s / 3600)}h`;
    return `há ${Math.round(s / 86400)}d`;
  };

  const batteryIcon = (v) => {
    if (v >= 95) return "mdi:battery";
    if (v < 5) return "mdi:battery-outline";
    return `mdi:battery-${Math.max(10, Math.floor(v / 10) * 10)}`;
  };

  const batteryColor = (v) => (v <= 20 ? "#e53935" : v <= 50 ? "#fdd835" : v <= 70 ? "#9ccc65" : "#43a047");

  /* Cor da moldura tirada do próprio papel: mesma matiz, afastada em
   * luminosidade para aparecer. No papel escuro ela CLAREIA (é o lilás da
   * moldura roxa); no claro, escurece. Assim a borda combina sozinha com o
   * tom escolhido, em vez de virar mais um campo de cor para acertar na mão. */
  const paperEdge = (key, dark) => {
    const m = /^([a-z]+)-([1-7])$/.exec(String(key || "").trim());
    const table = dark ? PAPER_DARK_TONES : PAPER_TONES;
    if (!m) return dark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.20)";
    const hue = (dark ? PAPER_DARK_HUES : PAPER_HUES).find((h) => h[0] === m[1]);
    if (!hue) return dark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.20)";
    const [l, s] = table[+m[2] - 1];
    return dark
      ? `hsl(${hue[2]}, ${Math.min(60, s + 14)}%, ${Math.min(72, l + 26)}%)`
      : `hsl(${hue[2]}, ${Math.min(60, s + 10)}%, ${Math.max(30, l - 26)}%)`;
  };

  /* ======================= geometria da cena ======================= */
  // Um sistema de coordenadas só, em unidades de usuário do SVG. A janela não
  // ocupa a cena inteira: sobra margem dos dois lados para o tubo do ar e para
  // as tomadas, que ficam "ao lado da janela" e não dentro dela.

  const SC = { W: 360, H: 230 };
  const FR = { x: 44, y: 8, w: 272, h: 188, t: 11 };   // esquadria (moldura)
  const GL = { x: FR.x + FR.t, y: FR.y + FR.t, w: FR.w - 2 * FR.t, h: FR.h - 2 * FR.t };
  const SILL = { x: FR.x - 10, y: FR.y + FR.h, w: FR.w + 20, h: 11 };

  const FRAME_TONES = {
    claro:    { a: "#e9e2d4", b: "#c9c0ad", c: "#a79c86" },
    escuro:   { a: "#4a453d", b: "#2f2b25", c: "#1b1815" },
    branco:   { a: "#fbfbf9", b: "#e2e0da", c: "#bdbab1" },
    madeira:  { a: "#a9793f", b: "#7d552a", c: "#54381a" },
    aluminio: { a: "#d8dce0", b: "#aab1b8", c: "#7d858d" },
  };

  /* ===================== descoberta de entidades ===================== */

  const friendly = (hass, id) => hass?.states?.[id]?.attributes?.friendly_name || id;
  const deviceOf = (hass, id) => hass?.entities?.[id]?.device_id || "";

  const areaOf = (hass, id) => {
    const e = hass?.entities?.[id];
    if (!e) return "";
    if (e.area_id) return e.area_id;
    const d = e.device_id && hass.devices?.[e.device_id];
    return (d && d.area_id) || "";
  };

  const areaOptions = (hass) => Object.values(hass?.areas || {})
    .map((a) => ({ value: a.area_id, label: a.name }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

  const entOptions = (hass, filter, withNone) => {
    const list = Object.keys(hass?.states || {}).filter(filter)
      .map((id) => ({ value: id, label: `${friendly(hass, id)} (${id})` }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    return withNone ? [{ value: "__none__", label: "— nenhum —" }].concat(list) : list;
  };

  const isCover = (hass, id) => id.startsWith("cover.");
  const isOpening = (hass, id) => id.startsWith("binary_sensor.") &&
    ["window", "door", "opening", "garage_door"].includes(hass.states[id]?.attributes?.device_class);
  const isTemp = (hass, id) => hass.states[id]?.attributes?.device_class === "temperature";
  const isHum = (hass, id) => hass.states[id]?.attributes?.device_class === "humidity";
  const isBatt = (hass, id) => hass.states[id]?.attributes?.device_class === "battery";

  // Bateria do mesmo dispositivo do sensor de clima; sem registro, pelo nome.
  const autoBattery = (hass, ref) => {
    if (!ref || !hass) return "";
    const dev = deviceOf(hass, ref);
    if (dev && hass.entities) {
      const found = Object.keys(hass.entities).find(
        (id) => hass.entities[id].device_id === dev && isBatt(hass, id) && hass.states[id]);
      if (found) return found;
    }
    const base = String(ref).split(".")[1] || "";
    for (const suf of ["_bateria", "_battery", "_battery_level", "_nivel_da_bateria"]) {
      if (hass.states[`sensor.${base}${suf}`]) return `sensor.${base}${suf}`;
    }
    return "";
  };

  /* Preenchimento automático pelo ambiente.
   * A casa nomeia as coisas com disciplina ("JANELA ESQUERDA DA SALA",
   * "CORTINA DA SUÍTE", "Temperatura da Janela do Quarto"), então dá para
   * montar a janela inteira a partir da área — é isso que o botão
   * "Montar a janela sozinho" do editor usa. Heurística, não adivinhação
   * mágica: tudo que ele preenche continua editável campo a campo. */
  const discoverForArea = (hass, areaId) => {
    if (!hass || !areaId) return {};
    const mine = Object.keys(hass.states).filter((id) => areaOf(hass, id) === areaId);
    const txt = (id) => `${id} ${friendly(hass, id)}`.toLowerCase();
    const has = (id, re) => re.test(txt(id));
    const out = {};

    const covers = mine.filter((id) => isCover(hass, id));
    const curtains = covers.filter((id) => has(id, /cortina|curtain/));
    const blackouts = covers.filter((id) => has(id, /blackout|black.?out/));
    const windows = covers.filter((id) => has(id, /janela|window/) &&
      !curtains.includes(id) && !blackouts.includes(id));

    if (curtains[0]) out.curtain = curtains[0];
    if (blackouts[0]) out.blackout = blackouts[0];
    // esquerda antes de direita: a folha da esquerda é a que o dono chama de
    // "principal" nas janelas de quatro folhas
    const byHand = (l) => l.slice().sort((a, b) =>
      (has(a, /esquerd/) ? 0 : 1) - (has(b, /esquerd/) ? 0 : 1));
    const w = byHand(windows);
    if (w[0]) out.opener = w[0];
    if (w[1]) { out.opener_right = w[1]; out.panes = 4; out.slide = "out"; }

    const sens = mine.filter((id) => isOpening(hass, id) && has(id, /janela|window/));
    const sl = sens.find((id) => has(id, /esquerd|left/));
    const sr = sens.find((id) => has(id, /direit|right/));
    if (sl) out.sensor_left = sl;
    if (sr) out.sensor_right = sr;

    // o sensor da própria janela ganha do sensor genérico do ambiente
    const pick = (test) => {
      const all = mine.filter(test);
      return all.find((id) => has(id, /janela|window/)) || all[0] || "";
    };
    const t = pick((id) => isTemp(hass, id));
    const h = pick((id) => isHum(hass, id));
    if (t) out.temperature = t;
    if (h) out.humidity = h;

    const acc = [];
    const fanEx = mine.find((id) => id.startsWith("fan.") && has(id, /exaust/));
    if (fanEx) acc.push({ type: "exhaust", entity: fanEx, x: 82, y: 16, size: 26 });
    const sockets = mine.filter((id) => id.startsWith("switch.") && has(id, /tomada|socket|plug/));
    sockets.slice(0, 2).forEach((id, i) => acc.push({ type: "socket", entity: id, x: 6, y: 62 + i * 18, size: 22 }));
    if (acc.length) out.accessories = acc;

    const area = hass.areas?.[areaId];
    if (area?.name) out.name = `JANELA · ${area.name.toUpperCase()}`;
    return out;
  };

  /* ===================== leitura do estado do HA ===================== */

  const coverInfo = (hass, id, invert) => {
    const st = hass?.states?.[id];
    if (!id || !st) return null;
    const pos = st.attributes.current_position;
    let p = Number.isFinite(Number(pos)) ? Number(pos)
      : st.state === "open" ? 100 : st.state === "closed" ? 0 : 50;
    if (invert) p = 100 - p;
    return {
      id,
      name: st.attributes.friendly_name || id,
      state: st.state,
      pos: clamp(Math.round(p), 0, 100),
      moving: st.state === "opening" || st.state === "closing",
      dead: st.state === "unavailable" || st.state === "unknown",
      hasPosition: Number.isFinite(Number(pos)),
    };
  };

  const numState = (hass, id) => {
    const v = Number.parseFloat(hass?.states?.[id]?.state);
    return Number.isFinite(v) ? v : null;
  };

  // Fase do dia. Com sun.sun usa a elevação de verdade; sem ela, o relógio.
  const dayPhase = (hass, sunId) => {
    const sun = sunId && hass?.states?.[sunId];
    const el = sun ? Number.parseFloat(sun.attributes?.elevation) : NaN;
    if (Number.isFinite(el)) {
      if (el > 12) return { key: "day", el };
      if (el > 1.5) return { key: "dusk", el };      // sol raso: dourado
      if (el > -6) return { key: "twilight", el };   // crepúsculo civil
      return { key: "night", el };
    }
    const h = new Date().getHours();
    if (h >= 7 && h < 16) return { key: "day", el: 40 };
    if (h >= 16 && h < 18) return { key: "dusk", el: 8 };
    if (h >= 5 && h < 7) return { key: "twilight", el: -2 };
    if (h >= 18 && h < 20) return { key: "twilight", el: -2 };
    return { key: "night", el: -20 };
  };

  const SKY = {
    day:      ["#7ec8f2", "#cfeaf8", "#eaf6fb"],
    dusk:     ["#f6a45c", "#f8cf8e", "#ffe9c4"],
    twilight: ["#4b5b93", "#8f6f9e", "#e2a07e"],
    night:    ["#0b1230", "#152049", "#243568"],
  };

  /* ========================= peças do desenho ========================= */

  // Estrelas: posição fixa por semente; brilho por keyframe com atraso
  // negativo, então cada uma pisca no seu tempo sem JS por quadro.
  const STARS = (() => {
    const r = seeded(20260812);
    let out = "";
    for (let i = 0; i < 26; i++) {
      const x = GL.x + 6 + r() * (GL.w - 12);
      const y = GL.y + 4 + r() * (GL.h * 0.62);
      const rad = 0.5 + r() * 1.1;
      const d = (r() * 4).toFixed(2);
      out += `<circle class="star" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(2)}" style="animation-delay:-${d}s"/>`;
    }
    return out;
  })();

  const RAIN = (() => {
    const r = seeded(77001);
    let out = "";
    for (let i = 0; i < 16; i++) {
      const x = GL.x + r() * GL.w;
      const d = (r() * 1.1).toFixed(2);
      const len = 10 + r() * 12;
      out += `<line class="drop" x1="${x.toFixed(1)}" y1="${GL.y - 14}" x2="${(x - 4).toFixed(1)}" y2="${(GL.y - 14 + len).toFixed(1)}" style="animation-delay:-${d}s"/>`;
    }
    return out;
  })();

  const DEW = (() => {
    const r = seeded(31337);
    let out = "";
    for (let i = 0; i < 22; i++) {
      const x = GL.x + 4 + r() * (GL.w - 8);
      const y = GL.y + 4 + r() * (GL.h - 8);
      const rad = (0.8 + r() * 2.2).toFixed(2);
      const d = (r() * 6).toFixed(2);
      out += `<circle class="dew" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad}" style="animation-delay:-${d}s"/>`;
    }
    return out;
  })();

  const EMBER = (() => {
    const r = seeded(9091);
    let out = "";
    for (let i = 0; i < 10; i++) {
      const x = GL.x + 8 + r() * (GL.w - 16);
      const d = (r() * 5).toFixed(2);
      const s = (0.7 + r() * 1.1).toFixed(2);
      out += `<circle class="ember" cx="${x.toFixed(1)}" cy="${GL.y + GL.h - 4}" r="${s}" style="animation-delay:-${d}s"/>`;
    }
    return out;
  })();

  const SNOW = (() => {
    const r = seeded(5150);
    let out = "";
    for (let i = 0; i < 14; i++) {
      const x = GL.x + r() * GL.w;
      const d = (r() * 7).toFixed(2);
      const s = (0.9 + r() * 1.4).toFixed(2);
      out += `<circle class="flake" cx="${x.toFixed(1)}" cy="${GL.y - 6}" r="${s}" style="animation-delay:-${d}s"/>`;
    }
    return out;
  })();

  // Silhuetas da paisagem, em unidades da área de vidro.
  const skylinePath = (kind) => {
    const b = GL.y + GL.h;
    if (kind === "morros") {
      return `<path class="land" d="M${GL.x},${b} L${GL.x},${b - 34} Q${GL.x + 52},${b - 74} ${GL.x + 104},${b - 30}
        Q${GL.x + 150},${b - 68} ${GL.x + 196},${b - 26} Q${GL.x + 228},${b - 54} ${GL.x + GL.w},${b - 30} L${GL.x + GL.w},${b} Z"/>`;
    }
    if (kind === "mar") {
      return `<rect class="sea" x="${GL.x}" y="${b - 42}" width="${GL.w}" height="42"/>
        <path class="land" d="M${GL.x},${b - 42} Q${GL.x + 60},${b - 58} ${GL.x + 120},${b - 44}
          Q${GL.x + 190},${b - 60} ${GL.x + GL.w},${b - 46} L${GL.x + GL.w},${b - 42} Z"/>`;
    }
    if (kind === "campo") {
      return `<path class="land" d="M${GL.x},${b} L${GL.x},${b - 22} Q${GL.x + 130},${b - 40} ${GL.x + GL.w},${b - 18} L${GL.x + GL.w},${b} Z"/>
        <path class="tree" d="M${GL.x + 40},${b - 24} l7,-22 l7,22 Z M${GL.x + 196},${b - 20} l6,-18 l6,18 Z"/>`;
    }
    if (kind === "nenhum") return "";
    // cidade: prédios de larguras irregulares, com janelinhas acesas à noite
    const r = seeded(424242);
    let out = "";
    let x = GL.x;
    while (x < GL.x + GL.w) {
      const w = 12 + Math.round(r() * 16);
      const h = 24 + Math.round(r() * 58);
      out += `<rect class="bld" x="${x}" y="${b - h}" width="${Math.min(w, GL.x + GL.w - x)}" height="${h}"/>`;
      for (let wy = b - h + 6; wy < b - 8; wy += 9) {
        for (let wx = x + 3; wx < x + w - 4; wx += 7) {
          if (r() > 0.55) out += `<rect class="win" x="${wx}" y="${wy}" width="3" height="4"/>`;
        }
      }
      x += w + 2;
    }
    return out;
  };

  // Uma folha de vidro: reflexo diagonal + esquadria própria.
  const paneSvg = (x, w, cls, extra) => `
    <g class="pane ${cls}" ${extra || ""}>
      <rect class="glass" x="${x}" y="${GL.y}" width="${w}" height="${GL.h}"/>
      <rect class="sash" x="${x + 0.75}" y="${GL.y + 0.75}" width="${w - 1.5}" height="${GL.h - 1.5}" rx="1.5"/>
      <path class="shine" d="M${x + w * 0.08},${GL.y + GL.h} L${x + w * 0.52},${GL.y} L${x + w * 0.74},${GL.y} L${x + w * 0.30},${GL.y + GL.h} Z"/>
      <path class="shine soft" d="M${x + w * 0.60},${GL.y + GL.h} L${x + w * 0.92},${GL.y} L${x + w * 1.0},${GL.y} L${x + w * 0.72},${GL.y + GL.h} Z"/>
    </g>`;

  // Cortina: painel de pregas. A largura é fixa e a abertura entra como
  // scaleX — encolher horizontalmente é exatamente o que o tecido faz ao
  // franzir, e as pregas (que estão no gradiente) acompanham de graça.
  const curtainPanel = (side, x, w, top, bottom) => {
    const pleats = 9;
    const step = w / pleats;
    let d = `M${x},${top} L${x + w},${top} L${x + w},${bottom - 8}`;
    // barra inferior ondulada, uma barriga por prega
    for (let i = pleats; i > 0; i--) {
      const x1 = x + (i - 1) * step;
      const cx = x1 + step / 2;
      d += ` Q${cx},${bottom + (i % 2 ? 7 : 1)} ${x1},${bottom - 8}`;
    }
    d += " Z";
    return `<g class="curtain ${side}"><path class="cloth" d="${d}"/></g>`;
  };

  const TEXTURES = {
    paper:   { label: "Papel (liso, mais leve)", pleat: 0.16, sheen: 0.10, filter: "" },
    linho:   { label: "Linho (trama fina)",      pleat: 0.20, sheen: 0.07, filter: "url(#wcLinen)" },
    juta:    { label: "Juta (trama grossa)",     pleat: 0.24, sheen: 0.05, filter: "url(#wcJute)" },
    veludo:  { label: "Veludo (brilho macio)",   pleat: 0.30, sheen: 0.22, filter: "" },
    seda:    { label: "Seda (brilho vivo)",      pleat: 0.14, sheen: 0.34, filter: "" },
    voil:    { label: "Voil (transparente)",     pleat: 0.12, sheen: 0.14, filter: "" },
  };

  /* ============================== CARD ============================== */

  class MwWindowCurtainCard extends HTMLElement {
    setConfig(config) {
      const cfg = { ...DEFAULTS, ...(config || {}) };
      if (!cfg.opener && !cfg.curtain && !cfg.blackout && !cfg.sensor_left && !cfg.sensor_right) {
        throw new Error("mw-window-curtain-card: informe ao menos um empurrador, cortina, blackout ou sensor de abertura");
      }
      cfg.accessories = Array.isArray(cfg.accessories) ? cfg.accessories : [];
      // troca de estrutura obriga a remontar o SVG; troca de estado, não
      const shape = JSON.stringify([cfg.panes, cfg.slide, cfg.curtain, cfg.blackout, cfg.opener,
        cfg.opener_right, cfg.scenery, cfg.scenery_skyline, cfg.animate, cfg.controls,
        cfg.accessories, cfg.ac_duct, cfg.curtain_texture, cfg.curtain_open_from, cfg.depth,
        cfg.show_header, cfg.show_footer, cfg.paper, cfg.paper_dark,
        // geometria e lugar das coisas: mudar qualquer um remonta o SVG
        cfg.sensor_style, cfg.sensor_line_width, cfg.sensor_line_inset,
        cfg.sensor_left, cfg.sensor_right, cfg.chips_position, cfg.watermark_align,
        cfg.confirm_accessory, cfg.curtain_rod, cfg.curtain_overhang, cfg.curtain_top,
        cfg.curtain_drop, cfg.rod_offset, cfg.rod_extend, cfg.rod_thickness,
        cfg.temperature, cfg.humidity, cfg.drag_target]);
      const changed = shape !== this._shape;
      this._shape = shape;
      this._config = cfg;
      this._sig = null;
      if (this._hass && changed) this._build();
      else if (this._hass) this._paint();
    }

    set hass(hass) {
      const first = !this._hass;
      this._hass = hass;
      if (!this._config) return;
      if (first || !this.shadowRoot) this._build(); else this._paint();
    }

    getCardSize() {
      const c = this._config || DEFAULTS;
      return Math.round((c.scene_height / 50) + (c.controls === "none" ? 0 : 1.5));
    }

    static getConfigElement() { return document.createElement("mw-window-curtain-card-editor"); }

    static getStubConfig(hass) {
      const cover = Object.keys(hass?.states || {}).find(
        (id) => id.startsWith("cover.") && /janela|window/i.test(`${id} ${friendly(hass, id)}`));
      if (!cover) return { opener: "", curtain: "", sensor_left: "" };
      const area = areaOf(hass, cover);
      return area ? { area, ...discoverForArea(hass, area) } : { opener: cover };
    }

    connectedCallback() {
      // fora da tela ninguém vê a chuva cair: pausar poupa compositor num
      // dashboard com dez janelas abertas ao mesmo tempo
      if (!this._io && typeof IntersectionObserver !== "undefined") {
        this._io = new IntersectionObserver((es) => {
          const on = es.some((e) => e.isIntersecting);
          if (this._root) this._root.classList.toggle("paused", !on);
        }, { rootMargin: "80px" });
        this._io.observe(this);
      }
      if (!this._clock) this._clock = setInterval(() => { if (this._hass) this._paint(true); }, 60000);
    }

    disconnectedCallback() {
      if (this._io) { this._io.disconnect(); this._io = null; }
      if (this._clock) { clearInterval(this._clock); this._clock = null; }
    }

    /* --------------------------- leitura --------------------------- */

    _read() {
      const c = this._config;
      const hass = this._hass;
      const op1 = coverInfo(hass, c.opener, c.invert_position);
      const op2 = coverInfo(hass, c.opener_right, c.invert_position);
      const cur = coverInfo(hass, c.curtain, false);
      const bo = coverInfo(hass, c.blackout, false);
      const t = numState(hass, c.temperature);
      const h = numState(hass, c.humidity);
      const batId = c.battery || (c.battery_auto ? (this._autoBat !== undefined ? this._autoBat
        : (this._autoBat = autoBattery(hass, c.temperature || c.humidity))) : "");
      const bat = batId ? numState(hass, batId) : null;
      const rawL = hass.states[c.sensor_left]?.state;
      const rawR = hass.states[c.sensor_right]?.state;
      const openOf = (s) => (s === undefined ? null : c.sensor_invert ? s === "off" : s === "on");
      const phase = dayPhase(hass, c.sun_entity);
      const weather = c.weather_entity ? hass.states[c.weather_entity]?.state : "";
      return { op1, op2, cur, bo, t, h, bat, batId, sl: openOf(rawL), sr: openOf(rawR), phase, weather };
    }

    _fxKey(r) {
      const c = this._config;
      if (!c.animate || c.fx === "none") return "";
      if (c.fx !== "auto") return c.fx;
      const w = String(r.weather || "").toLowerCase();
      if (/rain|pour|storm|light/.test(w)) return "rain";
      if (/snow/.test(w)) return "cold";
      if (r.h !== null && r.h >= c.fx_rain) return "rain";
      if (r.t !== null && r.t >= c.fx_hot) return "hot";
      if (r.t !== null && r.t <= c.fx_cold) return "cold";
      if (r.h !== null && r.h >= c.fx_dew) return "dew";
      return "";
    }

    /* ---------------------------- montagem ---------------------------- */

    _build() {
      const c = this._config;
      // grafite: modo escuro assumido, SENÃO dependência de tema/interruptor —
      // a chave escolhida é a cor que lê, sempre.
      const dark = c.paper_dark === true || isGrafite(c.paper);
      const ink = paperInk(dark);
      const paperBg = isGrafite(c.paper) ? grafiteGradient(c.paper)
        : dark ? paperDarkGradient(c.paper) : paperGradient(c.paper);
      const tex = TEXTURES[c.curtain_texture] || TEXTURES.paper;
      const curtainBg = c.curtain_paper
        ? (isGrafite(c.curtain_paper) ? grafiteGradient(c.curtain_paper)
          : c.curtain_dark ? paperDarkGradient(c.curtain_paper) : paperGradient(c.curtain_paper))
        : paperBg;
      const curtainStop = this._gradientStops(c.curtain_paper || c.paper,
        c.curtain_paper ? c.curtain_dark : dark);
      const boStop = this._gradientStops(c.blackout_paper, c.blackout_dark !== false);
      const frameTone = FRAME_TONES[c.frame_tone] || (dark ? FRAME_TONES.escuro : FRAME_TONES.claro);

      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML =
        `<style>${this._css(c, dark, ink, paperBg, frameTone, tex)}</style>` +
        `<ha-card class="root">${this._header(c)}${this._scene(c, tex, curtainStop, boStop)}` +
        `${this._footer(c)}${this._controls(c)}</ha-card>`;

      // Remontar o shadow DOM invalida TODA referência guardada. Esquecer uma
      // delas não dá erro: o card simplesmente para de atualizar aquele pedaço
      // (o sintoma foi o «--» eterno nos controles depois de mexer no editor).
      this._ctlEls = null;
      this._accEls = null;
      this._skyStops = null;
      this._imgSrc = null;

      const $ = (s) => this.shadowRoot.querySelector(s);
      this._root = $(".root");
      this._el = {
        title: $(".title"), summary: $(".summary"),
        temp: $(".v-temp"), hum: $(".v-hum"), bat: $(".v-bat"), batIcon: $(".i-bat"),
        dotL: $(".dot-l"), dotR: $(".dot-r"), badges: $(".badges"),
        lineL: $(".sl-l"), lineR: $(".sl-r"),
        sceneImg: $(".sceneryImg"),
      };
      this._wire();
      this._sig = null;
      this._paint();
    }

    /* A caixa do desenho cresce com a cortina.
     * Cortina que desce abaixo do peitoril e varão que sobe acima da janela
     * saem do viewBox e o card, que tem `overflow:hidden`, corta o pano. Em
     * vez de encolher a cortina, a cena ganha o espaço de que precisa — e o
     * `.scene` acompanha pela mesma proporção, senão os acessórios (que são
     * HTML em % da caixa) descolam do desenho. */
    _viewBox(c) {
      if (!c.curtain) return { x: 0, y: 0, w: SC.W, h: SC.H };
      const rodTop = GL.y - numOr(c.curtain_top, 0) - 9 - numOr(c.rod_offset, 0)
        - numOr(c.rod_thickness, 4.5) * 0.9;
      const clothBot = GL.y + GL.h + numOr(c.curtain_drop, 0) + 8;
      const top = Math.max(0, Math.ceil(2 - rodTop));
      const bot = Math.max(0, Math.ceil(clothBot - SC.H));
      return { x: 0, y: -top, w: SC.W, h: SC.H + top + bot };
    }

    _gradientStops(key, dark) {
      // O papel vem como CSS linear-gradient e o SVG precisa das duas paradas
      // separadas — extrair é mais honesto que manter duas tabelas de cor.
      const g = isGrafite(key) ? grafiteGradient(key)
        : dark ? paperDarkGradient(key) : paperGradient(key);
      const m = g.match(/(hsl\([^)]*\)|#[0-9a-f]{3,8})/gi) || [];
      return { a: m[0] || (dark ? "#2b2825" : "#fdfaf3"), b: m[1] || (dark ? "#161411" : "#e8e3d8") };
    }

    // As pastilhas são as mesmas em qualquer lugar; muda só onde entram.
    // As pastilhas de sensor só aparecem no estilo "pills"/"both" — quem
    // escolheu o risco vertical não quer a informação duas vezes.
    _chips(c, wm) {
      const bits = [];
      // marca d'água é para ler de longe: "Esq./Dir." vira ruído lá, e quem
      // quer o estado de abertura sobre o vidro já tem o risco vertical
      const dots = c.sensor_style !== "line" && !wm;
      if (dots && c.sensor_left) bits.push(`<span class="pill"><i class="dot dot-l"></i>Esq.</span>`);
      if (dots && c.sensor_right) bits.push(`<span class="pill"><i class="dot dot-r"></i>Dir.</span>`);
      if (c.temperature) bits.push(`<span class="pill chip-t"><ha-icon icon="mdi:thermometer"></ha-icon><b class="v-temp">--</b></span>`);
      if (c.humidity) bits.push(`<span class="pill chip-h"><ha-icon icon="mdi:water-percent"></ha-icon><b class="v-hum">--</b></span>`);
      bits.push(`<span class="pill bat"><ha-icon class="i-bat" icon="mdi:battery-unknown"></ha-icon><b class="v-bat">--</b></span>`);
      return bits.join("");
    }

    _header(c) {
      if (c.show_header === false) return "";
      const noTopo = c.chips_position === "header" && c.show_footer !== false;
      return `<div class="head">
        <div class="titlewrap"><div class="title"></div>
          ${c.show_summary === false ? "" : `<div class="summary"></div>`}</div>
        ${noTopo ? `<div class="headchips">${this._chips(c)}</div>` : ""}
        <div class="badges"></div>
      </div>`;
    }

    _footer(c) {
      if (c.show_footer === false || c.chips_position !== "footer") return "";
      return `<div class="foot">${this._chips(c)}</div>`;
    }

    _watermark(c) {
      if (c.show_footer === false || c.chips_position !== "watermark") return "";
      return `<div class="wmark wm-${esc(c.watermark_align || "bottom-left")}">${this._chips(c, true)}</div>`;
    }

    /* ------------------------------ cena ------------------------------ */

    _scene(c, tex, curtainStop, boStop) {
      const panes = c.panes === 4 ? 4 : 2;
      const pw = GL.w / panes;
      const slide = c.slide;

      // Quem é fixa e quem anda. Duas folhas: a esquerda é fixa e a direita
      // corre para trás dela (é assim que as janelas da casa abrem). Quatro:
      // as das pontas são fixas de fábrica, as duas do meio correm.
      let glass = "";
      if (panes === 2) {
        const a = slide === "right" ? 1 : 0;
        glass += paneSvg(GL.x + (a === 0 ? 0 : pw), pw, "fixed");
        glass += paneSvg(GL.x + (a === 0 ? pw : 0), pw, "move m1");
      } else {
        glass += paneSvg(GL.x, pw, "fixed");
        glass += paneSvg(GL.x + 3 * pw, pw, "fixed");
        glass += paneSvg(GL.x + pw, pw, "move m1");
        glass += paneSvg(GL.x + 2 * pw, pw, "move m2");
      }

      // Janela de correr não tem montante fixo no meio: as folhas passam uma
      // por trás da outra e quem divide o vidro é a esquadria de cada folha
      // (`.sash`). Um risco fixo no centro ficava por cima da folha aberta.

      // A cortina não vive dentro do vão: em casa ela sobra dos lados, sobe
      // acima e desce abaixo. Por isso ela é desenhada FORA do recorte, e na
      // frente da esquadria — que é onde o pano fica de verdade.
      const ovh = numOr(c.curtain_overhang, 0);
      const cX = GL.x - ovh;
      const cW = GL.w + 2 * ovh;
      const cTop = GL.y - numOr(c.curtain_top, 0);
      const cBot = GL.y + GL.h + numOr(c.curtain_drop, 0);
      // "cur-l"/"cur-r", e não "cl"/"cr": `.cl` é o rótulo do controle lá
      // embaixo, e a colisão fazia o rótulo herdar `scaleX(var(--cl))` — com
      // a cortina aberta ele encolhia até sumir. Classe curta é armadilha.
      const curtains = c.curtain ? (c.curtain_open_from === "sides"
        ? curtainPanel("cur-l", cX, cW / 2, cTop, cBot) + curtainPanel("cur-r", cX + cW / 2, cW / 2, cTop, cBot)
        : c.curtain_open_from === "right"
          ? curtainPanel("cur-r", cX, cW, cTop, cBot)
          : curtainPanel("cur-l", cX, cW, cTop, cBot)) : "";

      const rodT = numOr(c.rod_thickness, 4.5);
      const rodY = cTop - 9 - numOr(c.rod_offset, 0);
      const rodE = numOr(c.rod_extend, 12);
      const rod = (c.curtain && c.curtain_rod !== false) ? `
        <g class="rod">
          <rect x="${cX - rodE}" y="${rodY}" width="${cW + 2 * rodE}" height="${rodT}" rx="${rodT / 2}"/>
          <circle cx="${cX - rodE - 1}" cy="${rodY + rodT / 2}" r="${rodT * 0.89}"/>
          <circle cx="${cX + cW + rodE + 1}" cy="${rodY + rodT / 2}" r="${rodT * 0.89}"/>
        </g>` : "";

      // Sensor como risco vertical na borda do vão: verde aberto, vermelho
      // fechado. É a leitura de relance que a pastilha do rodapé não dá.
      const lw = numOr(c.sensor_line_width, 5);
      const li = numOr(c.sensor_line_inset, 0);
      const showLine = c.sensor_style === "line" || c.sensor_style === "both";
      const sline = (side) => `<rect class="sl sl-${side}" rx="${lw / 2}"
        x="${side === "l" ? GL.x - lw - li : GL.x + GL.w + li}" y="${GL.y}"
        width="${lw}" height="${GL.h}"/>`;
      const lines = showLine
        ? (c.sensor_left ? sline("l") : "") + (c.sensor_right ? sline("r") : "") : "";

      const blackout = c.blackout ? `
        <g class="bo">
          <rect class="boCloth" x="${GL.x}" y="${GL.y}" width="${GL.w}" height="${GL.h}"/>
          <g class="boBar"><rect x="${GL.x - 1}" y="${GL.y + GL.h - 5}" width="${GL.w + 2}" height="5" rx="2"/></g>
        </g>` : "";

      // Tubo flexível de verdade: a nervura é o MESMO caminho tracejado por
      // cima do tubo. Desenhar sanfona anel a anel custaria 20 nós por lado
      // e some no tamanho em que o card é visto.
      const duct = (side) => {
        const right = side === "r";
        const x0 = right ? FR.x + FR.w - 5 : FR.x + 5;
        const dir = right ? 1 : -1;
        const y = GL.y + GL.h * 0.60;
        const d = `M${x0},${y} q${dir * 19},3 ${dir * 25},19 q${dir * 4},13 ${dir * 3},22`;
        const cx = x0 + dir * 28;
        const cy = y + 41;
        return `<g class="duct duct-${side}">
          <path class="tube" d="${d}"/>
          <path class="tubeRib" d="${d}"/>
          <ellipse class="tubeCap" cx="${cx}" cy="${cy}" rx="7.5" ry="4.5"/>
          <ellipse class="tubeHole" cx="${cx}" cy="${cy}" rx="4.5" ry="2.4"/>
          <g class="air">
            <path d="M${cx - 5},${cy + 8} h10"/>
            <path d="M${cx - 7},${cy + 13} h14"/>
            <path d="M${cx - 4},${cy + 18} h8"/>
          </g>
        </g>`;
      };
      const ducts = c.ac_duct === "both" ? duct("l") + duct("r")
        : c.ac_duct === "left" ? duct("l") : c.ac_duct === "right" ? duct("r") : "";

      const fx = c.animate === false ? "" : `
        <g class="fxlayer">
          <g class="fx-rain">${RAIN}<g class="glassdrops">${DEW}</g></g>
          <g class="fx-dew">${DEW}</g>
          <g class="fx-hot"><path class="heat h1" d="M${GL.x},${GL.y + GL.h * 0.55} q30,-8 60,0 t60,0 t60,0 t60,0"/>
            <path class="heat h2" d="M${GL.x},${GL.y + GL.h * 0.72} q30,-8 60,0 t60,0 t60,0 t60,0"/>${EMBER}</g>
          <g class="fx-cold">${SNOW}
            <path class="frost" d="M${GL.x},${GL.y} q26,10 30,32 q-18,-6 -30,4 Z"/>
            <path class="frost" d="M${GL.x + GL.w},${GL.y} q-26,10 -30,32 q18,-6 30,4 Z"/>
            <path class="frost" d="M${GL.x},${GL.y + GL.h} q26,-10 30,-32 q-18,6 -30,-4 Z"/>
            <path class="frost" d="M${GL.x + GL.w},${GL.y + GL.h} q-26,-10 -30,-32 q18,6 30,-4 Z"/></g>
        </g>`;

      const sceneryImg = (c.scenery === "image" || c.scenery === "image_by_time")
        ? `<image class="sceneryImg" x="${GL.x}" y="${GL.y}" width="${GL.w}" height="${GL.h}"
             preserveAspectRatio="xMidYMid slice" href=""/>` : "";
      const painted = c.scenery === "painted" ? `
        <rect class="sky" x="${GL.x}" y="${GL.y}" width="${GL.w}" height="${GL.h}"/>
        <g class="celestial">
          <circle class="sun" cx="0" cy="0" r="13"/>
          <g class="moon"><circle class="moonDisc" cx="0" cy="0" r="10"/><circle class="moonCut" cx="4.5" cy="-3" r="9"/></g>
        </g>
        <g class="stars">${STARS}</g>
        <g class="skyline">${skylinePath(c.scenery_skyline)}</g>` : "";

      const acc = (c.accessories || []).map((a, i) => this._accessory(a, i)).join("");

      const vb = this._viewBox(c);
      return `<div class="scene">
        <svg class="svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" preserveAspectRatio="xMidYMid meet" role="img">
          <defs>
            <linearGradient id="wcCloth" x1="0" y1="0" x2="1" y2="0">
              ${this._pleatStops(curtainStop, tex)}
            </linearGradient>
            <linearGradient id="wcBo" x1="0" y1="0" x2="0" y2="1">
              ${this._slatStops(boStop)}
            </linearGradient>
            <linearGradient id="wcFrame" x1="0" y1="0" x2="0.35" y2="1">
              <stop offset="0" stop-color="var(--fr-a)"/><stop offset="0.55" stop-color="var(--fr-b)"/>
              <stop offset="1" stop-color="var(--fr-c)"/>
            </linearGradient>
            <clipPath id="wcClip"><rect x="${GL.x}" y="${GL.y}" width="${GL.w}" height="${GL.h}" rx="2"/></clipPath>
            <filter id="wcLinen" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.9 0.35" numOctaves="1" result="n"/>
              <feColorMatrix in="n" type="saturate" values="0"/>
              <feComposite operator="in" in2="SourceGraphic"/>
              <feBlend in2="SourceGraphic" mode="multiply"/>
            </filter>
            <filter id="wcJute" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.32 0.22" numOctaves="2" result="n"/>
              <feColorMatrix in="n" type="saturate" values="0"/>
              <feComposite operator="in" in2="SourceGraphic"/>
              <feBlend in2="SourceGraphic" mode="multiply"/>
            </filter>
          </defs>

          <g clip-path="url(#wcClip)">
            ${painted}${sceneryImg}${fx}
            ${glass}
            ${blackout}
          </g>
          <rect class="frame" x="${FR.x}" y="${FR.y}" width="${FR.w}" height="${FR.h}" rx="3"/>
          <rect class="frameIn" x="${GL.x - 1.5}" y="${GL.y - 1.5}" width="${GL.w + 3}" height="${GL.h + 3}" rx="2"/>
          <rect class="sill" x="${SILL.x}" y="${SILL.y}" width="${SILL.w}" height="${SILL.h}" rx="2.5"/>
          ${curtains}${rod}${ducts}
          <!-- o risco vai por ÚLTIMO: com cortina sobrando dos lados ele
               ficava escondido atrás do pano, e indicador que some não indica -->
          ${lines}
        </svg>
        ${this._watermark(c)}
        <div class="acc">${acc}</div>
        ${c.confirm_accessory ? `<div class="confirm" hidden>
          <div class="cbox"><span class="ctxt"></span>
            <span class="crow">
              <button class="cno" type="button">Não</button>
              <button class="cyes" type="button">Sim</button>
            </span></div></div>` : ""}
      </div>`;
    }

    // Pregas: paradas alternadas no mesmo gradiente. Como o gradiente é em
    // caixa delimitadora, ele encolhe junto com o scaleX do painel — cortina
    // franzida ganha prega estreita sozinha, que é o que o tecido faz.
    _pleatStops(stop, tex) {
      const n = 9;
      let out = "";
      for (let i = 0; i <= n; i++) {
        const o = (i / n).toFixed(3);
        const shade = i % 2 === 0 ? stop.a : stop.b;
        out += `<stop offset="${o}" stop-color="${shade}"/>`;
        if (i < n) {
          const mid = ((i + 0.5) / n).toFixed(3);
          out += `<stop offset="${mid}" stop-color="${i % 2 === 0 ? stop.b : stop.a}" stop-opacity="${(1 - tex.pleat).toFixed(2)}"/>`;
        }
      }
      return out;
    }

    // Ripas do blackout. Como o gradiente é em caixa delimitadora e o pano é
    // escalado em Y, as ripas se juntam conforme ele enrola — que é o que a
    // persiana de verdade faz ao subir.
    _slatStops(stop) {
      const n = 12;
      let out = "";
      for (let i = 0; i <= n; i++) {
        out += `<stop offset="${(i / n).toFixed(3)}" stop-color="${i % 2 ? stop.b : stop.a}"/>`;
      }
      return out;
    }

    _accessory(a, i) {
      const type = a.type || "socket";
      const x = clamp(numOr(a.x, 50), 0, 100);
      const y = clamp(numOr(a.y, 50), 0, 100);
      const size = clamp(numOr(a.size, 24), 10, 80);
      const icons = {
        exhaust: "mdi:fan", mini_fan: "mdi:fan", solar_fan: "mdi:solar-power-variant",
        socket: "mdi:power-socket-eu", sensor: "mdi:gauge", light: "mdi:lightbulb",
        plant: "mdi:flower", other: "mdi:circle-medium",
      };
      const spin = type === "exhaust" || type === "mini_fan" || type === "solar_fan";
      return `<button class="a a-${esc(type)}${spin ? " spin" : ""}" data-i="${i}"
        style="left:${x}%;top:${y}%;--as:${size}px"
        title="${esc(a.label || a.entity || type)}">
        <ha-icon icon="${esc(a.icon || icons[type] || icons.other)}"></ha-icon>
        ${type === "solar_fan" ? `<ha-icon class="blade" icon="mdi:fan"></ha-icon>` : ""}
        <span class="av"></span>
      </button>`;
    }

    /* ---------------------------- controles ---------------------------- */

    _controls(c) {
      if (c.controls === "none") return "";
      const rows = [];
      const row = (key, id, icon, label) => {
        if (!id) return;
        rows.push(`<div class="ctl" data-k="${key}">
          <ha-icon class="ci" icon="${icon}"></ha-icon>
          ${c.control_labels === false ? "" : `<span class="cl">${esc(label)}</span>`}
          <span class="cp" data-p="${key}">--</span>
          <input class="cs" type="range" min="0" max="100" step="1" value="0" data-s="${key}" aria-label="${esc(label)}">
          <span class="cb">
            <button data-a="open" data-k="${key}" title="Abrir"><ha-icon icon="mdi:chevron-up"></ha-icon></button>
            <button data-a="stop" data-k="${key}" title="Parar"><ha-icon icon="mdi:stop"></ha-icon></button>
            <button data-a="close" data-k="${key}" title="Fechar"><ha-icon icon="mdi:chevron-down"></ha-icon></button>
          </span>
        </div>`);
      };
      row("op1", c.opener, "mdi:window-open-variant", c.panes === 4 ? "Folha esquerda" : "Janela");
      row("op2", c.opener_right, "mdi:window-open-variant", "Folha direita");
      row("cur", c.curtain, "mdi:curtains", "Cortina");
      row("bo", c.blackout, "mdi:blinds-horizontal", "Blackout");
      if (!rows.length) return "";
      const compact = c.controls === "compact";
      return `<div class="ctls${compact ? " compact" : ""}">${rows.join("")}</div>`;
    }

    /* ------------------------------ CSS ------------------------------ */

    _css(c, dark, ink, paperBg, fr, tex) {
      const vb = this._viewBox(c);
      const depth = c.depth || "3d";
      const shadow = depth === "flat" ? "none"
        : depth === "soft"
          ? `0 2px 6px rgba(0,0,0,${dark ? 0.5 : 0.16}), 0 8px 20px rgba(0,0,0,${dark ? 0.35 : 0.10})`
          : `inset 1.5px 1.5px 0 rgba(255,255,255,${dark ? 0.10 : 0.55}),
             inset -1.5px -1.5px 0 rgba(0,0,0,${dark ? 0.45 : 0.10}),
             0 3px 5px rgba(0,0,0,${dark ? 0.55 : 0.18}),
             0 10px 26px rgba(0,0,0,${dark ? 0.42 : 0.14})`;
      const lift = depth === "3d" ? "translateY(-1px)" : "none";
      const R = `${numOr(c.radius_tl, 12)}px ${numOr(c.radius_tr, 12)}px ${numOr(c.radius_br, 12)}px ${numOr(c.radius_bl, 12)}px`;
      const sheer = c.curtain_texture === "voil";

      /* Moldura. `border` de verdade acompanha o `border-radius` sozinho e é
       * pintada uma vez — nenhum custo por quadro. O halo é um box-shadow
       * estático; o único que repinta é o do hover, e só do card sob o mouse.
       * Fora daqui de propósito: backdrop-filter (caro de verdade) e
       * `transition: all`, que animaria sombra a cada mudança de estado. */
      const bs = c.border_style || "hairline";
      const edge = c.border_color || paperEdge(c.paper, dark);
      const bw = clamp(numOr(c.border_width, 3), 0, 24);
      const glow = clamp(numOr(c.border_glow, 0.35), 0, 1);
      const border = bs === "none" ? "none"
        : bs === "hairline" ? `1px solid ${ink.line}`
        : `${bw}px solid ${edge}`;
      const halo = bs === "glow" && glow > 0
        ? `,0 0 ${Math.round(10 + glow * 26)}px rgba(${dark ? "180,140,230" : "120,90,170"},${glow.toFixed(2)})`
        : "";

      return `
:host{display:block;}
.root{
  box-sizing:border-box;padding:${numOr(c.padding, 10)}px;border-radius:${R};
  background-image:${paperBg};background-color:${dark ? "#1b1917" : "#f4f0e6"};
  border:${border};box-shadow:${shadow}${halo};transform:${lift};
  color:${ink.text};overflow:hidden;
  ${c.font_family ? `font-family:${c.font_family};` : ""}
  --ink:${ink.text};--dim:${ink.dim};--line:${ink.line};
  --fr-a:${fr.a};--fr-b:${fr.b};--fr-c:${fr.c};
  --o1:0;--o2:0;--cur:1;--cl:1;--cr:1;--bo:0;
  --sky-a:${SKY.day[0]};--sky-b:${SKY.day[1]};--sky-c:${SKY.day[2]};
  --sun-x:180px;--sun-y:60px;--night:0;--tempc:transparent;--humc:transparent;
  --dur:${c.animate === false ? "0ms" : "760ms"};
  transition:background-color 400ms ease;
}
.root.paused *{animation-play-state:paused !important;}
${c.hover_glow && bs !== "none" ? `
/* só no hover, e só box-shadow/border-color — nada de \`transition: all\`,
   que animaria sombra a cada mudança de estado do HA */
@media (hover:hover){
  .root{transition:box-shadow 260ms ease,border-color 260ms ease,
    background-color 400ms ease;}
  .root:hover{border-color:${edge};
    box-shadow:${shadow},0 0 ${Math.round(14 + glow * 30)}px
      rgba(${dark ? "190,150,240" : "130,100,180"},${Math.max(0.3, glow).toFixed(2)});}
}` : ""}
@media (prefers-reduced-motion:reduce){.root *{animation-play-state:paused !important;transition-duration:1ms !important;}}

/* ---------- cabeçalho ---------- */
/* com as pastilhas no topo o cabeçalho pode virar duas linhas: numa coluna
   estreita elas espremiam o nome até virar «SALA · RI…» */
.head{display:flex;align-items:center;gap:8px;padding:0 2px 7px;flex-wrap:wrap;}
.titlewrap{min-width:0;flex:1 1 55%;}
.title{font-size:${numOr(c.font_title, 13)}px;font-weight:700;letter-spacing:1.1px;line-height:1.2;
  text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  color:${c.color_title || "var(--ink)"};
  text-shadow:0 1px 1px rgba(0,0,0,${dark ? 0.6 : 0.14});}
.summary{font-size:${numOr(c.font_summary, 11)}px;color:${c.color_summary || "var(--dim)"};
  line-height:1.3;margin-top:1px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.badges{display:flex;gap:3px;font-size:${numOr(c.font_badge, 15)}px;line-height:1;flex:none;}
/* flex 0 1 auto: as pastilhas pegam só o que precisam, e os emojis ainda
   cabem na mesma linha — crescendo, empurravam os emojis para uma 3ª linha */
.headchips{display:flex;gap:4px;flex:0 1 auto;flex-wrap:wrap;justify-content:flex-end;}

/* ---------- cena ----------
   A caixa da cena tem EXATAMENTE a proporção do viewBox. Sem isso o SVG
   centraliza dentro de uma caixa mais larga e os acessórios — que são HTML
   posicionado em % da caixa — descolam da janela. scene_height é o teto de
   altura, virando limite de largura pela mesma proporção. */
.scene{position:relative;margin:0 auto;aspect-ratio:${vb.w} / ${vb.h};
  width:min(100%, ${Math.round(numOr(c.scene_height, 300) * vb.w / vb.h)}px);}
.svg{position:absolute;inset:0;width:100%;height:100%;display:block;overflow:visible;}

/* o fill do céu é o gradiente montado em _skyGrad(); a cor abaixo é só o
   que se vê no primeiro quadro, antes da primeira pintura */
.sky{fill:var(--sky-b);}

.celestial{transition:transform 900ms ease;transform:translate(var(--sun-x),var(--sun-y));}
.sun{fill:#ffe473;stroke:rgba(255,196,64,.55);stroke-width:2.5;
  filter:drop-shadow(0 0 10px rgba(255,206,84,.95)) drop-shadow(0 0 26px rgba(255,168,48,.6));
  opacity:calc(1 - var(--night));transition:opacity 700ms ease;}
.moon{opacity:var(--night);transition:opacity 700ms ease;}
.moonDisc{fill:#f2f0e4;filter:drop-shadow(0 0 8px rgba(226,232,255,.8));}
.moonCut{fill:var(--sky-a);}
.stars{opacity:var(--night);transition:opacity 900ms ease;}
.star{fill:#fff;animation:tw 3.4s ease-in-out infinite alternate;}
@keyframes tw{from{opacity:.18;}to{opacity:1;}}

.land{fill:rgba(18,26,22,calc(.55 + var(--night)*.35));}
.sea{fill:rgba(30,90,140,.6);}
.tree{fill:rgba(14,32,20,.8);}
.bld{fill:rgba(16,20,34,calc(.5 + var(--night)*.4));}
.win{fill:rgba(255,214,130,calc(var(--night)*.9));}

/* ---------- vidros e esquadria ---------- */
.pane{transition:transform var(--dur) cubic-bezier(.33,.9,.25,1);}
.glass{fill:rgba(190,225,245,.20);}
.sash{fill:none;stroke:url(#wcFrame);stroke-width:2.5;}
/* o reflexo é luz do dia batendo no vidro: à noite não existe */
.shine{fill:rgba(255,255,255,.20);opacity:calc(1 - var(--night) * .78);
  transition:opacity 700ms ease;}
.shine.soft{fill:rgba(255,255,255,.10);}
.m1{transform:translateX(calc(var(--o1) * var(--t1)));}
.m2{transform:translateX(calc(var(--o2) * var(--t2)));}
.frame{fill:none;stroke:url(#wcFrame);stroke-width:${FR.t};}
.frameIn{fill:none;stroke:rgba(0,0,0,.22);stroke-width:1;}
.sill{fill:url(#wcFrame);filter:drop-shadow(0 2px 2px rgba(0,0,0,.35));}

/* risco do sensor de abertura, na borda do vão */
.sl{fill:#9e9e9e;transition:fill 300ms ease,filter 300ms ease;}
.sl.open{fill:#9acd32;filter:drop-shadow(0 0 4px rgba(154,205,50,.9));}
.sl.closed{fill:#ff6347;}

/* arrastar: enquanto o dedo está na cena a folha segue sem transição, senão
   ela "persegue" o dedo com meio segundo de atraso */
.root.dragging .pane,.root.dragging .curtain,.root.dragging .boCloth,
.root.dragging .boBar{transition:none;}
.root.can-drag .scene{cursor:grab;touch-action:pan-y;}
.root.dragging .scene{cursor:grabbing;}

/* ---------- cortina ---------- */
.curtain{transition:transform var(--dur) cubic-bezier(.4,.75,.3,1);transform-box:fill-box;}
.cloth{fill:url(#wcCloth);${sheer ? "opacity:.62;" : ""}
  filter:${tex.filter ? `${tex.filter} ` : ""}drop-shadow(0 2px 4px rgba(0,0,0,.35));}
.cur-l{transform-origin:0% 50%;transform:scaleX(var(--cl));}
.cur-r{transform-origin:100% 50%;transform:scaleX(var(--cr));}
.rod rect,.rod circle{fill:url(#wcFrame);}
.rod{filter:drop-shadow(0 1px 1px rgba(0,0,0,.4));}

/* ---------- blackout ---------- */
.boCloth{fill:url(#wcBo);transform-box:fill-box;transform-origin:50% 0%;
  transform:scaleY(var(--bo));transition:transform var(--dur) cubic-bezier(.4,.75,.3,1);}
.boBar rect{fill:rgba(0,0,0,.55);}
.boBar{transform:translateY(calc((var(--bo) - 1) * ${GL.h}px));
  transition:transform var(--dur) cubic-bezier(.4,.75,.3,1);opacity:var(--bo-on,0);}

/* ---------- tubo do ar ---------- */
.tube{fill:none;stroke:#c9ced3;stroke-width:11;stroke-linecap:round;
  filter:drop-shadow(0 1px 2px rgba(0,0,0,.35));}
.tubeRib{fill:none;stroke:rgba(0,0,0,.22);stroke-width:11;stroke-linecap:butt;
  stroke-dasharray:1.6 4.4;}
.tubeCap{fill:#b9bfc5;stroke:rgba(0,0,0,.30);stroke-width:1;}
.tubeHole{fill:rgba(20,26,32,.75);}
.air path{stroke:rgba(140,205,255,.9);stroke-width:1.8;stroke-linecap:round;fill:none;opacity:0;}
.root.ac-on .air path{animation:blow 1.6s ease-out infinite;}
.root.ac-on .air path:nth-child(2){animation-delay:.4s;}
.root.ac-on .air path:nth-child(3){animation-delay:.8s;}
@keyframes blow{0%{opacity:0;transform:translateY(0);}30%{opacity:.95;}
  100%{opacity:0;transform:translateY(9px);}}

/* ---------- efeitos ---------- */
.fxlayer>g{display:none;}
.root.fx-rain .fx-rain,.root.fx-dew .fx-dew,.root.fx-hot .fx-hot,.root.fx-cold .fx-cold{display:block;}
.drop{stroke:rgba(200,230,255,.75);stroke-width:1.2;stroke-linecap:round;
  animation:fall 1.05s linear infinite;}
@keyframes fall{from{transform:translate(0,0);opacity:0;}
  10%{opacity:.9;}to{transform:translate(-26px,${GL.h + 30}px);opacity:0;}}
.glassdrops .dew{fill:rgba(220,240,255,.5);animation:slide 5.5s ease-in infinite;}
@keyframes slide{0%{opacity:0;transform:translateY(0);}15%{opacity:.85;}
  100%{opacity:0;transform:translateY(26px);}}
.dew{fill:rgba(225,240,250,.42);animation:breathe 5s ease-in-out infinite alternate;}
@keyframes breathe{from{opacity:.15;}to{opacity:.75;}}
.heat{fill:none;stroke:rgba(255,170,90,.34);stroke-width:2.4;
  animation:shimmer 3.4s ease-in-out infinite alternate;}
.heat.h2{animation-duration:4.3s;stroke:rgba(255,120,60,.26);}
@keyframes shimmer{from{transform:translate(0,0) scaleY(1);}to{transform:translate(-14px,-5px) scaleY(1.1);}}
.ember{fill:rgba(255,170,70,.85);animation:rise 5.2s ease-in infinite;}
@keyframes rise{0%{opacity:0;transform:translateY(0);}12%{opacity:.9;}
  100%{opacity:0;transform:translate(9px,-${GL.h * 0.8}px);}}
.frost{fill:rgba(226,244,255,.5);}
.flake{fill:rgba(255,255,255,.85);animation:snow 8s linear infinite;}
@keyframes snow{0%{opacity:0;transform:translate(0,0);}10%{opacity:.9;}
  100%{opacity:0;transform:translate(14px,${GL.h + 20}px);}}

/* ---------- acessórios ---------- */
.acc{position:absolute;inset:0;pointer-events:none;}
.a{position:absolute;transform:translate(-50%,-50%);pointer-events:auto;
  width:var(--as);height:var(--as);display:grid;place-items:center;padding:0;
  border-radius:50%;cursor:pointer;background:rgba(255,255,255,${dark ? 0.10 : 0.55});
  border:1px solid ${ink.line};color:var(--ink);
  box-shadow:0 1px 2px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.35);
  backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);transition:transform 140ms ease,background 200ms ease;}
.a:hover{transform:translate(-50%,-50%) scale(1.08);}
.a ha-icon{--mdc-icon-size:calc(var(--as) * .62);width:calc(var(--as) * .62);height:calc(var(--as) * .62);}
.a .blade{display:none;}
.a.on{background:rgba(255,214,120,.85);color:#231d0f;box-shadow:0 0 10px rgba(255,200,90,.75);}
.a.spin.on ha-icon{animation:spin 1.1s linear infinite;}
.a.spin.slow.on ha-icon{animation-duration:2.4s;}
@keyframes spin{to{transform:rotate(360deg);}}
.a .av{position:absolute;bottom:-13px;font-size:${numOr(c.font_accessory, 9)}px;font-weight:700;
  color:${c.color_accessory || "var(--ink)"};
  white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,.45);}

/* ---------- confirmação do acessório ---------- */
.confirm{position:absolute;inset:0;display:grid;place-items:center;z-index:4;
  background:rgba(0,0,0,.45);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);}
.confirm[hidden]{display:none;}
.cbox{display:flex;flex-direction:column;gap:8px;align-items:center;padding:12px 16px;
  border-radius:12px;background:${dark ? "rgba(32,30,28,.96)" : "rgba(253,250,243,.97)"};
  border:1px solid var(--line);box-shadow:0 6px 20px rgba(0,0,0,.45);max-width:88%;}
.ctxt{font-size:12.5px;font-weight:600;text-align:center;color:var(--ink);}
.crow{display:flex;gap:8px;}
.crow button{padding:6px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;
  border:1px solid var(--line);background:rgba(${dark ? "255,255,255,.08" : "0,0,0,.05"});
  color:var(--ink);}
.crow .cyes{background:#9acd32;color:#1a1a1a;border-color:#9acd32;}
.crow button:active{transform:translateY(1px);}
.a-socket.on{background:rgba(150,220,140,.85);color:#12220f;box-shadow:0 0 10px rgba(140,220,130,.7);}

/* ---------- rodapé e marca d'água ---------- */
.foot{display:flex;flex-wrap:wrap;gap:5px;align-items:center;
  padding:7px ${numOr(c.controls_inset, 6)}px 0;}
/* marca d'água: as mesmas pastilhas, pousadas sobre o vidro. Sem receber
   ponteiro, para não roubar o arrasto da cortina que passa por baixo. */
/* empilhada, não em linha: lado a lado as pastilhas grandes se atropelam e
   atravessam a janela inteira */
.wmark{position:absolute;display:flex;flex-direction:column;gap:5px;pointer-events:none;
  opacity:${clamp(numOr(c.watermark_opacity, 0.55), 0, 1)};max-width:70%;}
.wm-bottom-left{left:6%;bottom:11%;align-items:flex-start;}
.wm-bottom-right{right:6%;bottom:11%;align-items:flex-end;}
.wm-top-left{left:6%;top:8%;align-items:flex-start;}
.wm-top-right{right:6%;top:8%;align-items:flex-end;}
.wm-center{left:50%;top:50%;transform:translate(-50%,-50%);align-items:center;}
.wmark .pill{font-size:${numOr(c.font_watermark, 26)}px;padding:4px 10px;
  backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);
  ${c.color_watermark ? `color:${c.color_watermark};` : ""}
  border-color:rgba(255,255,255,.28);text-shadow:0 1px 3px rgba(0,0,0,.5);}
.wmark .pill ha-icon{--mdc-icon-size:${Math.round(numOr(c.font_watermark, 26) * 0.9)}px;
  width:${Math.round(numOr(c.font_watermark, 26) * 0.9)}px;
  height:${Math.round(numOr(c.font_watermark, 26) * 0.9)}px;}
.pill{display:inline-flex;align-items:center;gap:3px;
  font-size:${numOr(c.font_chip, 11)}px;line-height:1;
  ${c.color_chip ? `color:${c.color_chip};` : ""}
  padding:3px 7px;border-radius:999px;border:1px solid var(--line);
  background:rgba(${dark ? "255,255,255,.05" : "0,0,0,.035"});}
.pill ha-icon{--mdc-icon-size:13px;width:13px;height:13px;opacity:.85;}
.chip-t{background:var(--tempc);}
.chip-h{background:var(--humc);}
.dot{width:8px;height:8px;border-radius:50%;background:#9e9e9e;
  box-shadow:0 0 0 1px rgba(0,0,0,.2) inset;transition:background 300ms ease;}
.dot.open{background:#9acd32;box-shadow:0 0 6px rgba(154,205,50,.8);}
.dot.closed{background:#ff6347;}

/* ---------- controles ----------
   O recuo lateral existe porque o card tem canto arredondado: com padding 2px
   o ícone da cortina encostava na curva. */
.ctls{display:grid;gap:5px;margin-top:6px;border-top:1px solid var(--line);
  padding:8px ${numOr(c.controls_inset, 6)}px 1px;}
.ctl{display:grid;grid-template-columns:auto ${c.control_labels === false ? "" : "minmax(0,1fr)"} auto minmax(60px,1.2fr) auto;
  align-items:center;gap:7px;}
.ctls.compact .ctl{grid-template-columns:auto ${c.control_labels === false ? "" : "minmax(0,1fr)"} auto minmax(40px,1fr) auto;}
.ci{--mdc-icon-size:17px;width:17px;height:17px;opacity:.85;}
.cl{font-size:${numOr(c.font_control, 11)}px;color:${c.color_control || "var(--dim)"};
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.cp{font-size:${numOr(c.font_percent, 11)}px;font-weight:700;min-width:32px;text-align:right;
  ${c.color_percent ? `color:${c.color_percent};` : ""}font-variant-numeric:tabular-nums;}
.cs{-webkit-appearance:none;appearance:none;height:6px;border-radius:3px;background:var(--line);outline:none;}
.cs::-webkit-slider-thumb{-webkit-appearance:none;width:15px;height:15px;border-radius:50%;
  background:var(--ink);border:2px solid ${dark ? "#1b1917" : "#fdfaf3"};cursor:pointer;
  box-shadow:0 1px 3px rgba(0,0,0,.4);}
.cs::-moz-range-thumb{width:15px;height:15px;border-radius:50%;background:var(--ink);
  border:2px solid ${dark ? "#1b1917" : "#fdfaf3"};cursor:pointer;}
.cb{display:inline-flex;gap:2px;}
.cb button{display:grid;place-items:center;width:26px;height:24px;padding:0;cursor:pointer;
  border:1px solid var(--line);background:rgba(${dark ? "255,255,255,.06" : "0,0,0,.04"});
  color:var(--ink);border-radius:6px;transition:background 150ms ease,transform 100ms ease;}
.cb button:first-child{border-radius:6px 2px 2px 6px;}
.cb button:last-child{border-radius:2px 6px 6px 2px;}
.cb button:hover{background:rgba(${dark ? "255,255,255,.14" : "0,0,0,.10"});}
.cb button:active{transform:translateY(1px);}
.cb ha-icon{--mdc-icon-size:15px;width:15px;height:15px;}
.ctl.moving .cp{animation:blink 1.1s ease-in-out infinite;}
@keyframes blink{50%{opacity:.35;}}
.ctl.dead{opacity:.45;pointer-events:none;}`;
    }

    /* ---------------------------- pintura ---------------------------- */

    _paint(force) {
      if (!this._root || !this._hass || !this._config) return;
      const c = this._config;
      const r = this._read();
      const fx = this._fxKey(r);
      const sig = JSON.stringify([
        r.op1?.pos, r.op1?.state, r.op2?.pos, r.op2?.state, r.cur?.pos, r.cur?.state,
        r.bo?.pos, r.bo?.state, r.t, r.h, r.bat, r.sl, r.sr, r.phase.key,
        Math.round(r.phase.el), fx,
        (c.accessories || []).map((a) => this._hass.states[a.entity]?.state).join(","),
        c.ac_entity ? this._hass.states[c.ac_entity]?.state : "",
      ]);
      if (!force && sig === this._sig) return;
      this._sig = sig;

      const S = this._root.style;
      const panes = c.panes === 4 ? 4 : 2;
      const pw = GL.w / panes;
      // o que está debaixo do dedo não é repintado: o estado velho do HA
      // puxaria a cortina de volta no meio do arrasto
      const dk = this._dragging;

      // abertura: 0 = fechada, 1 = folha inteiramente recolhida
      const o1 = r.op1 ? r.op1.pos / 100 : 0;
      const o2 = r.op2 ? r.op2.pos / 100 : (panes === 4 ? o1 : 0);
      if (dk !== "op1") S.setProperty("--o1", o1.toFixed(3));
      if (dk !== "op2" && dk !== "op1") S.setProperty("--o2", o2.toFixed(3));
      if (panes === 2) {
        S.setProperty("--t1", `${c.slide === "right" ? pw : -pw}px`);
        S.setProperty("--t2", "0px");
      } else {
        const left = c.slide === "right" ? pw : -pw;
        S.setProperty("--t1", `${c.slide === "out" ? -pw : left}px`);
        S.setProperty("--t2", `${c.slide === "out" ? pw : left}px`);
      }

      // cortina: cover 100 = aberta; cobertura é o complemento
      const covC = r.cur ? (100 - r.cur.pos) / 100 : 0;
      if (dk !== "cur") {
        if (c.curtain_open_from === "sides") {
          S.setProperty("--cl", covC.toFixed(3));
          S.setProperty("--cr", covC.toFixed(3));
        } else {
          S.setProperty("--cl", c.curtain_open_from === "right" ? "0" : covC.toFixed(3));
          S.setProperty("--cr", c.curtain_open_from === "right" ? covC.toFixed(3) : "0");
        }
      }
      const covB = r.bo ? (100 - r.bo.pos) / 100 : 0;
      if (dk !== "bo") {
        S.setProperty("--bo", covB.toFixed(3));
        S.setProperty("--bo-on", covB > 0.01 ? "1" : "0");
      }

      // céu e astro
      const ph = r.phase;
      const sky = SKY[ph.key] || SKY.day;
      S.setProperty("--sky-a", sky[0]);
      S.setProperty("--sky-b", sky[1]);
      S.setProperty("--sky-c", sky[2]);
      S.setProperty("--night", ph.key === "night" ? "1" : ph.key === "twilight" ? "0.72" : "0");
      const skyEl = this.shadowRoot.querySelector(".sky");
      if (skyEl) skyEl.setAttribute("fill", `url(#wcSkyGrad)`);
      this._skyGrad(sky);
      // O astro anda num arco. De dia a altura é a elevação de verdade do sol.
      // De noite NÃO: a elevação do sol está a -20°, e pendurar a lua no mesmo
      // ponto a esconderia embaixo do horizonte — some justo a lua, que é o que
      // se quer ver numa janela à noite. À noite a lua sobe pelo relógio.
      const hour = new Date().getHours() + new Date().getMinutes() / 60;
      const night = ph.key === "night" || ph.key === "twilight";
      const el = clamp(numOr(ph.el, 30), -12, 72);
      const frac = night ? 0.74 : (el + 12) / 84;
      const across = night
        ? clamp(((hour + 12) % 24) / 24 * 1.25 - 0.1, 0.08, 0.92)
        : clamp((hour - 5.5) / 13, 0.06, 0.94);
      S.setProperty("--sun-x", `${(GL.x + across * GL.w).toFixed(1)}px`);
      S.setProperty("--sun-y", `${(GL.y + GL.h * 0.68 - frac * GL.h * 0.56).toFixed(1)}px`);

      // paisagem por imagem
      if (this._el.sceneImg) {
        const map = {
          day: c.scenery_image_day, dusk: c.scenery_image_dusk,
          twilight: c.scenery_image_dusk || c.scenery_image_night, night: c.scenery_image_night,
        };
        const src = c.scenery === "image_by_time"
          ? (map[ph.key] || c.scenery_image_dawn || c.scenery_image_day || c.scenery_image)
          : c.scenery_image;
        if (src && this._imgSrc !== src) { this._imgSrc = src; this._el.sceneImg.setAttribute("href", src); }
      }

      // efeitos
      for (const k of ["rain", "dew", "hot", "cold"]) this._root.classList.toggle(`fx-${k}`, fx === k);

      // clima no rodapé
      if (this._el.temp) {
        this._el.temp.textContent = r.t === null ? "--" : `${r.t.toFixed(1).replace(".", ",")} °C`;
        S.setProperty("--tempc", mwClimateColor("temp", r.t, 0.5) || "transparent");
      }
      if (this._el.hum) {
        this._el.hum.textContent = r.h === null ? "--" : `${Math.round(r.h)} %`;
        S.setProperty("--humc", mwClimateColor("hum", r.h, 0.5) || "transparent");
      }
      if (this._el.bat) {
        const has = r.bat !== null;
        this._el.bat.textContent = has ? `${Math.round(r.bat)} %` : "--";
        this._el.bat.parentElement.style.display = r.batId ? "" : "none";
        if (this._el.batIcon && has) {
          this._el.batIcon.setAttribute("icon", batteryIcon(r.bat));
          this._el.batIcon.style.color = batteryColor(r.bat);
        }
      }
      const dot = (el2, v) => {
        if (!el2) return;
        el2.classList.toggle("open", v === true);
        el2.classList.toggle("closed", v === false);
      };
      dot(this._el.dotL, r.sl);
      dot(this._el.dotR, r.sr);
      dot(this._el.lineL, r.sl);
      dot(this._el.lineR, r.sr);

      // cabeçalho
      if (this._el.title) {
        this._el.title.textContent = c.name ||
          (r.op1?.name || r.cur?.name || r.bo?.name || "Janela").replace(/^[^\p{L}\d]+/u, "");
      }
      if (this._el.summary) this._el.summary.textContent = this._summary(r);
      if (this._el.badges) this._el.badges.innerHTML = this._badges(c, r);

      // acessórios
      this._paintAccessories(r);
      const acSt = c.ac_entity ? this._hass.states[c.ac_entity]?.state : "";
      this._root.classList.toggle("ac-on", !!acSt && acSt !== "off" && acSt !== "unavailable");

      // controles
      this._paintControls(r);
    }

    // O gradiente do céu precisa de <stop> de verdade: variável CSS dentro de
    // stop-color funciona no Chrome mas não em todo lugar, então os stops são
    // reescritos aqui — três atributos, não um innerHTML novo.
    _skyGrad(sky) {
      if (!this._skyStops) {
        const defs = this.shadowRoot.querySelector("defs");
        if (!defs) return;
        const ns = "http://www.w3.org/2000/svg";
        const g = document.createElementNS(ns, "linearGradient");
        g.setAttribute("id", "wcSkyGrad");
        g.setAttribute("x1", "0"); g.setAttribute("y1", "0");
        g.setAttribute("x2", "0"); g.setAttribute("y2", "1");
        const stops = ["0", "0.55", "1"].map((o) => {
          const s = document.createElementNS(ns, "stop");
          s.setAttribute("offset", o);
          g.appendChild(s);
          return s;
        });
        defs.appendChild(g);
        this._skyStops = stops;
      }
      this._skyStops.forEach((s, i) => s.setAttribute("stop-color", sky[i]));
    }

    _summary(r) {
      const bits = [];
      if (r.op1) bits.push(r.op1.dead ? "empurrador indisponível"
        : r.op1.pos >= 99 ? "aberta" : r.op1.pos <= 1 ? "fechada" : `aberta ${r.op1.pos}%`);
      if (r.op2) bits.push(`dir. ${r.op2.pos}%`);
      if (r.cur) bits.push(r.cur.pos <= 1 ? "cortina fechada"
        : r.cur.pos >= 99 ? "cortina aberta" : `cortina ${r.cur.pos}%`);
      if (r.bo) bits.push(r.bo.pos <= 1 ? "blackout fechado"
        : r.bo.pos >= 99 ? "blackout aberto" : `blackout ${r.bo.pos}%`);
      if (!bits.length && (r.sl !== null || r.sr !== null)) {
        bits.push(r.sl || r.sr ? "aberta" : "fechada");
      }
      return bits.join(" · ");
    }

    // Emojis de condição: é o que o dono pediu para o caso "combinação" —
    // a imagem acompanha o horário, temperatura e umidade viram carimbo.
    _badges(c, r) {
      const mode = c.badges || "auto";
      if (mode === "none") return "";
      const out = [];
      const wantT = mode === "temp" || mode === "both" || mode === "auto";
      const wantH = mode === "humidity" || mode === "both" || mode === "auto";
      if (wantT && r.t !== null) {
        out.push(r.t <= 8 ? "🥶" : r.t <= 15 ? "🧊" : r.t <= 21 ? "🌤️"
          : r.t <= 27 ? "☀️" : r.t <= 33 ? "🥵" : "🔥");
      }
      if (wantH && r.h !== null) {
        out.push(r.h <= 30 ? "🌵" : r.h <= 45 ? "🍃" : r.h <= 60 ? "💧"
          : r.h <= 75 ? "🌫️" : "🌊");
      }
      if (mode === "auto" && r.phase.key === "night") out.push("🌙");
      return out.map((e) => `<span>${e}</span>`).join("");
    }

    _paintAccessories(r) {
      const list = this._config.accessories || [];
      if (!list.length) return;
      if (!this._accEls) this._accEls = [...this.shadowRoot.querySelectorAll(".a")];
      this._accEls.forEach((btn, i) => {
        const a = list[i];
        if (!a) return;
        const st = a.entity ? this._hass.states[a.entity] : null;
        let on = st ? st.state === "on" || st.state === "playing" || st.state === "open" : false;
        // a ventoinha solar não tem entidade: quem a liga é o sol
        if (a.type === "solar_fan" && !a.entity) on = r.phase.key === "day" || r.phase.key === "dusk";
        btn.classList.toggle("on", on);
        btn.classList.toggle("slow", a.type === "solar_fan" || a.type === "mini_fan");
        const label = btn.querySelector(".av");
        if (label) {
          let txt = "";
          if (a.show_value !== false && st) {
            const u = st.attributes.unit_of_measurement;
            if (u) txt = `${st.state} ${u}`;
            else if (a.type === "sensor") txt = st.state;
          }
          label.textContent = txt;
        }
      });
    }

    _paintControls(r) {
      if (!this._ctlEls) {
        this._ctlEls = {};
        this.shadowRoot.querySelectorAll(".ctl").forEach((el) => { this._ctlEls[el.dataset.k] = el; });
      }
      const map = { op1: r.op1, op2: r.op2, cur: r.cur, bo: r.bo };
      for (const [k, info] of Object.entries(map)) {
        const el = this._ctlEls[k];
        if (!el || !info) continue;
        el.classList.toggle("moving", info.moving);
        el.classList.toggle("dead", info.dead);
        const p = el.querySelector(".cp");
        if (p) p.textContent = info.dead ? "—" : `${info.pos}%`;
        const s = el.querySelector(".cs");
        // não arrastar o slider debaixo do dedo de quem está arrastando
        if (s && this._dragging !== k) s.value = String(info.pos);
        if (s) s.disabled = !info.hasPosition;
      }
    }

    /* ----------------------------- eventos ----------------------------- */

    _wire() {
      const root = this._root;
      const idOf = (k) => ({ op1: this._config.opener, op2: this._config.opener_right,
        cur: this._config.curtain, bo: this._config.blackout }[k]);

      root.querySelectorAll(".cb button").forEach((b) => {
        b.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const id = idOf(b.dataset.k);
          if (!id) return;
          const svc = { open: "open_cover", close: "close_cover", stop: "stop_cover" }[b.dataset.a];
          this._hass.callService("cover", svc, { entity_id: id });
        });
      });

      root.querySelectorAll(".cs").forEach((s) => {
        const k = s.dataset.s;
        s.addEventListener("pointerdown", () => { this._dragging = k; });
        s.addEventListener("change", (ev) => {
          ev.stopPropagation();
          this._dragging = null;
          const id = idOf(k);
          if (!id) return;
          let v = Number(ev.target.value);
          if (k.startsWith("op") && this._config.invert_position) v = 100 - v;
          this._hass.callService("cover", "set_cover_position", { entity_id: id, position: v });
        });
        s.addEventListener("click", (ev) => ev.stopPropagation());
      });

      root.querySelectorAll(".a").forEach((btn) => {
        btn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const a = (this._config.accessories || [])[Number(btn.dataset.i)];
          if (!a || !a.entity) return;
          const dom = a.entity.split(".")[0];
          const info = a.tap === "more-info" || ["sensor", "binary_sensor"].includes(dom);
          if (info) { this._moreInfo(a.entity); return; }
          const run = () => this._hass.callService("homeassistant", "toggle", { entity_id: a.entity });
          if (this._config.confirm_accessory) this._ask(a, run); else run();
        });
      });

      this._wireConfirm();
      this._wireScene();
    }

    // Confirmação: painel sobre a cena, com o nome do que vai acontecer.
    // Preferi isto a "toque duas vezes" porque acessório é alvo pequeno —
    // exigir pontaria duas vezes seria pior, não mais seguro.
    _ask(a, run) {
      const box = this.shadowRoot.querySelector(".confirm");
      if (!box) { run(); return; }
      const st = a.entity ? this._hass.states[a.entity] : null;
      const nome = a.label || st?.attributes?.friendly_name || a.entity;
      const verbo = st && (st.state === "on" || st.state === "open") ? "Desligar" : "Ligar";
      box.querySelector(".ctxt").textContent = `${verbo} ${nome}?`;
      this._pending = run;
      box.hidden = false;
    }

    _wireConfirm() {
      const box = this.shadowRoot.querySelector(".confirm");
      if (!box) return;
      const close = () => { box.hidden = true; this._pending = null; };
      box.addEventListener("click", (ev) => { ev.stopPropagation(); if (ev.target === box) close(); });
      box.querySelector(".cno").addEventListener("click", (ev) => { ev.stopPropagation(); close(); });
      box.querySelector(".cyes").addEventListener("click", (ev) => {
        ev.stopPropagation();
        const run = this._pending;
        close();
        if (run) run();
      });
    }

    /* Toque, toque longo e — quando ligado — ARRASTAR a cena para mover a
     * folha, a cortina ou o blackout com o dedo. O arrasto vence o toque:
     * passou do limiar, o `pointerup` não dispara `tap_action`. */
    _wireScene() {
      const scene = this._root.querySelector(".scene");
      if (!scene) return;
      const c = this._config;
      const target = c.opener || c.curtain || c.blackout || c.sensor_left;
      const dragKey = { opener: "op1", opener_right: "op2", curtain: "cur", blackout: "bo" }[c.drag_target];
      const dragId = { op1: c.opener, op2: c.opener_right, cur: c.curtain, bo: c.blackout }[dragKey];
      const canDrag = !!dragId;
      this._root.classList.toggle("can-drag", canDrag);

      let hold = null, held = false, dragging = false, startPos = 0, x0 = 0, y0 = 0, live = 0;

      const clearHold = () => { if (hold) { clearTimeout(hold); hold = null; } };

      scene.addEventListener("pointerdown", (ev) => {
        held = false; dragging = false;
        x0 = ev.clientX; y0 = ev.clientY;
        if (canDrag) {
          const info = this._read()[dragKey];
          startPos = info ? info.pos : 0;
          live = startPos;
        }
        hold = setTimeout(() => { held = true; hold = null; this._act(c.hold_action, target); }, 500);
      });

      scene.addEventListener("pointermove", (ev) => {
        if (!canDrag || held) return;
        const dx = ev.clientX - x0;
        const dy = ev.clientY - y0;
        // blackout desce e sobe; folha e cortina correm de lado
        const vertical = dragKey === "bo";
        const delta = vertical ? -dy : dx;
        if (!dragging && Math.abs(delta) < 6) return;
        if (!dragging) {
          dragging = true;
          clearHold();
          this._root.classList.add("dragging");
          scene.setPointerCapture?.(ev.pointerId);
        }
        ev.preventDefault();
        const rect = scene.getBoundingClientRect();
        const span = vertical ? rect.height : rect.width;
        live = clamp(Math.round(startPos + (delta / Math.max(1, span)) * 100), 0, 100);
        this._previewPos(dragKey, live);
      });

      const endDrag = (ev) => {
        clearHold();
        if (!dragging) return;
        dragging = false;
        this._root.classList.remove("dragging");
        scene.releasePointerCapture?.(ev.pointerId);
        this._dragging = null;
        let v = live;
        if (dragKey.startsWith("op") && c.invert_position) v = 100 - v;
        this._hass.callService("cover", "set_cover_position", { entity_id: dragId, position: v });
      };

      scene.addEventListener("pointerup", (ev) => {
        const arrastou = dragging;
        endDrag(ev);
        if (held || arrastou || ev.target.closest(".a") || ev.target.closest(".confirm")) return;
        this._act(c.tap_action, target);
      });
      ["pointerleave", "pointercancel"].forEach((t) =>
        scene.addEventListener(t, (ev) => { clearHold(); endDrag(ev); }));
    }

    // Move só o desenho, sem falar com o HA — o serviço vai no fim do arrasto.
    // `_dragging` segura a repintura para o estado antigo não puxar de volta.
    _previewPos(key, pos) {
      const c = this._config;
      const S = this._root.style;
      this._dragging = key;
      if (key === "op1" || key === "op2") {
        S.setProperty(key === "op1" ? "--o1" : "--o2", (pos / 100).toFixed(3));
        if (c.panes === 4 && !c.opener_right) S.setProperty("--o2", (pos / 100).toFixed(3));
      } else if (key === "cur") {
        const cov = ((100 - pos) / 100).toFixed(3);
        if (c.curtain_open_from === "sides") { S.setProperty("--cl", cov); S.setProperty("--cr", cov); }
        else S.setProperty(c.curtain_open_from === "right" ? "--cr" : "--cl", cov);
      } else if (key === "bo") {
        S.setProperty("--bo", ((100 - pos) / 100).toFixed(3));
        S.setProperty("--bo-on", pos < 99 ? "1" : "0");
      }
      const ctl = this._ctlEls && this._ctlEls[key];
      if (ctl) {
        const p = ctl.querySelector(".cp");
        if (p) p.textContent = `${pos}%`;
        const s = ctl.querySelector(".cs");
        if (s) s.value = String(pos);
      }
    }

    _act(action, entity) {
      const c = this._config;
      switch (action) {
        case "none": return;
        case "toggle":
          if (entity) this._hass.callService("cover", "toggle", { entity_id: entity }); return;
        case "navigate":
          if (!c.navigation_path) return;
          history.pushState(null, "", c.navigation_path);
          window.dispatchEvent(new CustomEvent("location-changed", { bubbles: true, composed: true }));
          return;
        case "more-info":
        default:
          if (entity) this._moreInfo(entity);
      }
    }

    _moreInfo(entityId) {
      this.dispatchEvent(new CustomEvent("hass-more-info",
        { bubbles: true, composed: true, detail: { entityId } }));
    }
  }

  /* ============================== EDITOR ============================== */

  const LABELS = {
    name: "Nome do card (vazio = nome da entidade)",
    area: "Ambiente",
    show_header: "Mostrar o cabeçalho",
    show_summary: "Mostrar o resumo abaixo do nome",
    panes: "Folhas de vidro",
    slide: "Para onde a folha corre",
    opener: "Empurrador (folha móvel)",
    opener_right: "2º empurrador (folha móvel da direita)",
    invert_position: "Empurrador invertido (0 = aberto)",
    sensor_left: "Sensor de abertura · esquerda",
    sensor_right: "Sensor de abertura · direita",
    sensor_invert: "Sensores invertidos (ligado = fechado)",
    sensor_style: "Como mostrar os sensores",
    sensor_line_width: "Espessura do risco",
    sensor_line_inset: "Afastamento do risco",
    temperature: "Sensor de temperatura",
    humidity: "Sensor de umidade",
    battery: "Bateria do sensor",
    battery_auto: "Descobrir a bateria sozinho",
    show_footer: "Mostrar o rodapé técnico",
    curtain: "Cortina",
    curtain_open_from: "A cortina abre",
    curtain_texture: "Tecido",
    curtain_paper: "Tom de papel da cortina (vazio = o do card)",
    curtain_dark: "Cortina em papel escuro",
    curtain_rod: "Desenhar o varão",
    curtain_overhang: "Sobra da cortina em cada lado",
    curtain_top: "Quanto a cortina começa acima do vão",
    curtain_drop: "Quanto a cortina desce abaixo do vão",
    rod_offset: "Subir o varão",
    rod_extend: "Quanto o varão passa de cada lado",
    rod_thickness: "Espessura do varão",
    blackout: "Blackout",
    blackout_paper: "Tom de papel do blackout",
    blackout_dark: "Blackout em papel escuro",
    ac_duct: "Tubo de ar-condicionado",
    ac_entity: "Entidade do ar-condicionado (sopro animado)",
    scenery: "Paisagem lá fora",
    scenery_image: "Imagem fixa da paisagem",
    scenery_image_dawn: "Imagem · amanhecer",
    scenery_image_day: "Imagem · dia",
    scenery_image_dusk: "Imagem · fim de tarde",
    scenery_image_night: "Imagem · noite",
    scenery_skyline: "Silhueta desenhada",
    badges: "Carimbos de condição (emoji)",
    sun_entity: "Entidade do sol",
    weather_entity: "Entidade de tempo (chuva de verdade)",
    animate: "Animar",
    fx: "Efeito no vidro",
    fx_hot: "Calor a partir de (°C)",
    fx_cold: "Frio abaixo de (°C)",
    fx_rain: "Chuva a partir de (% UR)",
    fx_dew: "Orvalho a partir de (% UR)",
    paper: "Tom de papel do card",
    paper_dark: "Papel escuro",
    depth: "Relevo",
    border_style: "Borda do card",
    border_width: "Espessura da moldura",
    border_color: "Cor da moldura (vazio = tirada do papel)",
    border_glow: "Intensidade do halo",
    hover_glow: "Acender ao passar o mouse (só no desktop)",
    frame_tone: "Cor da esquadria",
    radius_tl: "Canto ↖", radius_tr: "Canto ↗", radius_br: "Canto ↘", radius_bl: "Canto ↙",
    scene_height: "Altura máxima da cena",
    padding: "Folga interna",
    controls: "Controles",
    control_labels: "Mostrar o rótulo de cada controle",
    controls_inset: "Recuo lateral dos controles",
    chips_position: "Onde ficam temperatura, umidade e bateria",
    watermark_opacity: "Opacidade da marca d'água",
    watermark_align: "Canto da marca d'água",
    tap_action: "Toque na cena",
    hold_action: "Toque longo na cena",
    navigation_path: "Caminho para navegar",
    drag_target: "Arrastar na cena move",
    confirm_accessory: "Pedir confirmação ao tocar num acessório",
    font_family: "Fonte (vazio = a do tema)",
    font_title: "Nome: tamanho", color_title: "Nome: cor",
    font_summary: "Resumo: tamanho", color_summary: "Resumo: cor",
    font_chip: "Pastilhas: tamanho", color_chip: "Pastilhas: cor",
    font_control: "Rótulo do controle: tamanho", color_control: "Rótulo do controle: cor",
    font_percent: "Porcentagem: tamanho", color_percent: "Porcentagem: cor",
    font_accessory: "Acessório: tamanho", color_accessory: "Acessório: cor",
    font_watermark: "Marca d'água: tamanho", color_watermark: "Marca d'água: cor",
    font_badge: "Emojis do topo: tamanho",
  };

  const OPT = {
    panes: [{ value: 2, label: "2 folhas — uma fixa, uma que corre" },
            { value: 4, label: "4 folhas — as das pontas fixas, as do meio correm" }],
    slide: [{ value: "left", label: "Para a esquerda" }, { value: "right", label: "Para a direita" },
            { value: "out", label: "Para os lados (4 folhas)" }],
    curtain_open_from: [{ value: "sides", label: "Do meio para os lados (dois panos)" },
      { value: "left", label: "Um pano, recolhe à esquerda" },
      { value: "right", label: "Um pano, recolhe à direita" }],
    curtain_texture: Object.entries(TEXTURES).map(([v, t]) => ({ value: v, label: t.label })),
    ac_duct: [{ value: "none", label: "Nenhum" }, { value: "left", label: "À esquerda" },
      { value: "right", label: "À direita" }, { value: "both", label: "Dos dois lados" }],
    scenery: [{ value: "painted", label: "Desenhada (céu, sol, lua, silhueta)" },
      { value: "image", label: "Imagem fixa" },
      { value: "image_by_time", label: "Imagem que muda com o horário" },
      { value: "none", label: "Nenhuma (vidro sobre o fundo do card)" }],
    scenery_skyline: [{ value: "cidade", label: "Cidade" }, { value: "morros", label: "Morros" },
      { value: "mar", label: "Mar" }, { value: "campo", label: "Campo" }, { value: "nenhum", label: "Só o céu" }],
    badges: [{ value: "auto", label: "Automático (temperatura + umidade + noite)" },
      { value: "temp", label: "Só temperatura" }, { value: "humidity", label: "Só umidade" },
      { value: "both", label: "Temperatura e umidade" }, { value: "none", label: "Nenhum" }],
    fx: [{ value: "auto", label: "Automático (pelos sensores)" }, { value: "rain", label: "Chuva" },
      { value: "hot", label: "Calor" }, { value: "cold", label: "Frio" },
      { value: "dew", label: "Orvalho no vidro" }, { value: "none", label: "Nenhum" }],
    depth: [{ value: "3d", label: "3D (relevo de papel)" }, { value: "soft", label: "Suave" },
      { value: "flat", label: "Chapado" }],
    border_style: [{ value: "hairline", label: "Fio discreto (padrão)" },
      { value: "soft", label: "Moldura suave, na cor do papel" },
      { value: "glow", label: "Moldura suave com halo" },
      { value: "none", label: "Sem borda" }],
    frame_tone: [{ value: "auto", label: "Automático (segue o papel)" },
      { value: "claro", label: "Claro" }, { value: "escuro", label: "Escuro" },
      { value: "branco", label: "Branco" }, { value: "madeira", label: "Madeira" },
      { value: "aluminio", label: "Alumínio" }],
    controls: [{ value: "auto", label: "Automático (uma linha por cover)" },
      { value: "compact", label: "Compacto" }, { value: "none", label: "Nenhum" }],
    actions: [{ value: "more-info", label: "Abrir detalhes" }, { value: "toggle", label: "Alternar" },
      { value: "navigate", label: "Navegar" }, { value: "none", label: "Nada" }],
    sensor_style: [{ value: "pills", label: "Pastilhas no rodapé (como sempre foi)" },
      { value: "line", label: "Risco vertical na borda do vão" },
      { value: "both", label: "Os dois" }],
    chips_position: [{ value: "footer", label: "No rodapé" },
      { value: "header", label: "No topo, junto dos emojis" },
      { value: "watermark", label: "Marca d'água sobre o vidro" }],
    watermark_align: [{ value: "bottom-left", label: "Canto inferior esquerdo" },
      { value: "bottom-right", label: "Canto inferior direito" },
      { value: "top-left", label: "Canto superior esquerdo" },
      { value: "top-right", label: "Canto superior direito" },
      { value: "center", label: "No meio" }],
    drag_target: [{ value: "none", label: "Nada (só toque)" },
      { value: "curtain", label: "A cortina" }, { value: "opener", label: "A folha da janela" },
      { value: "opener_right", label: "A 2ª folha (janela de 4 folhas)" },
      { value: "blackout", label: "O blackout (arrastar para cima e para baixo)" }],
  };

  const ACC_TYPES = [
    { value: "exhaust", label: "Exaustor", icon: "mdi:fan" },
    { value: "mini_fan", label: "Ventoinha pequena", icon: "mdi:fan" },
    { value: "solar_fan", label: "Ventoinha solar (sem entidade)", icon: "mdi:solar-power-variant" },
    { value: "socket", label: "Tomada", icon: "mdi:power-socket-eu" },
    { value: "sensor", label: "Sensor (mostra o valor)", icon: "mdi:gauge" },
    { value: "light", label: "Luz", icon: "mdi:lightbulb" },
    { value: "plant", label: "Planta", icon: "mdi:flower" },
    { value: "other", label: "Outro", icon: "mdi:circle-medium" },
  ];

  const TABS = [
    { id: "janela", icon: "mdi:window-open-variant", label: "Janela" },
    { id: "panos", icon: "mdi:curtains", label: "Cortina" },
    { id: "clima", icon: "mdi:thermometer", label: "Clima" },
    { id: "extras", icon: "mdi:fan", label: "Acessórios" },
    { id: "paisagem", icon: "mdi:image-filter-hdr", label: "Paisagem" },
    { id: "estilo", icon: "mdi:palette", label: "Estilo" },
    { id: "textos", icon: "mdi:format-font", label: "Textos" },
  ];

  class MwWindowCurtainCardEditor extends HTMLElement {
    setConfig(config) {
      this._config = { ...config };
      if (!Array.isArray(this._config.accessories)) this._config.accessories = [];
      this._render();
    }

    set hass(hass) {
      // O HA chama setConfig ANTES de entregar o hass, e sem hass o esquema
      // não tem lista de entidades nem prévia — cai no campo único de reserva.
      // A primeira entrega do hass tem de remontar tudo; as seguintes só
      // repassam, senão o editor se reconstrói a cada atualização de estado.
      const first = !this._hass;
      this._hass = hass;
      if (!this._built) return;
      for (const f of Object.values(this._forms)) f.hass = hass;
      if (this._preview) this._preview.hass = hass;
      if (first) this._render();
    }

    get _cfg() { return this._config || {}; }

    /* ------------------------- esqueleto do editor ------------------------- */

    _render() {
      if (!this._built) this._build();
      this._syncForms();
      this._paintPreview();
      this._paintSwatches();
      this._paintAccList();
    }

    _build() {
      this._built = true;
      this._forms = {};
      this.innerHTML = `
        <style>
          .wc-ed{display:block;font-family:var(--paper-font-family,inherit);}
          .wc-prev{position:relative;border:1px solid var(--divider-color);border-radius:12px;
            padding:10px;margin-bottom:12px;background:var(--card-background-color);}
          .wc-prev>.tag{position:absolute;top:-9px;left:12px;font-size:10px;letter-spacing:.6px;
            text-transform:uppercase;background:var(--card-background-color);padding:0 6px;
            color:var(--secondary-text-color);}
          .wc-auto{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px;}
          .wc-auto select{flex:1;min-width:160px;padding:8px;border-radius:8px;
            border:1px solid var(--divider-color);background:var(--card-background-color);
            color:var(--primary-text-color);font-size:13px;}
          .wc-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;
            border:1px solid var(--divider-color);background:var(--primary-color);color:#fff;
            font-size:13px;font-weight:600;cursor:pointer;}
          .wc-btn.ghost{background:transparent;color:var(--primary-text-color);}
          .wc-btn:hover{filter:brightness(1.08);}
          .wc-tabs{display:flex;gap:4px;overflow-x:auto;border-bottom:1px solid var(--divider-color);
            margin-bottom:10px;padding-bottom:2px;scrollbar-width:thin;}
          .wc-tab{display:inline-flex;align-items:center;gap:5px;padding:8px 11px;cursor:pointer;
            border:none;background:transparent;color:var(--secondary-text-color);font-size:12.5px;
            border-bottom:2px solid transparent;white-space:nowrap;border-radius:6px 6px 0 0;}
          .wc-tab ha-icon{--mdc-icon-size:17px;width:17px;height:17px;}
          .wc-tab[aria-selected=true]{color:var(--primary-color);border-bottom-color:var(--primary-color);
            font-weight:600;background:rgba(127,127,127,.08);}
          .wc-pane{display:none;}
          .wc-pane.on{display:block;}
          .wc-sec{font-size:11px;text-transform:uppercase;letter-spacing:.9px;
            color:var(--secondary-text-color);margin:14px 0 6px;font-weight:700;}
          .wc-sw{display:grid;grid-template-columns:repeat(8,1fr);gap:4px;}
          .wc-sw b{grid-column:1/-1;font-size:10.5px;font-weight:600;color:var(--secondary-text-color);
            margin-top:4px;}
          .wc-chip{height:26px;border-radius:6px;border:1px solid rgba(127,127,127,.35);cursor:pointer;
            padding:0;position:relative;transition:transform 120ms ease;}
          .wc-chip:hover{transform:scale(1.12);z-index:2;}
          .wc-chip[aria-pressed=true]{outline:2.5px solid var(--primary-color);outline-offset:1px;z-index:3;}
          .wc-pad{position:relative;width:100%;aspect-ratio:360/230;border-radius:10px;
            border:1px dashed var(--divider-color);background:
              linear-gradient(90deg,rgba(127,127,127,.10) 1px,transparent 1px) 0 0/12.5% 100%,
              linear-gradient(rgba(127,127,127,.10) 1px,transparent 1px) 0 0/100% 12.5%;
            margin:8px 0;cursor:crosshair;overflow:hidden;touch-action:none;}
          .wc-pad .win{position:absolute;left:12.2%;top:3.5%;width:75.5%;height:81.7%;
            border:3px solid rgba(127,127,127,.45);border-radius:4px;background:rgba(120,180,220,.10);}
          .wc-pin{position:absolute;transform:translate(-50%,-50%);width:26px;height:26px;
            border-radius:50%;display:grid;place-items:center;cursor:grab;
            background:var(--primary-color);color:#fff;border:2px solid #fff;
            box-shadow:0 1px 4px rgba(0,0,0,.4);touch-action:none;}
          .wc-pin.sel{outline:2px solid var(--accent-color,#ff9800);outline-offset:2px;}
          .wc-pin ha-icon{--mdc-icon-size:15px;width:15px;height:15px;}
          .wc-arow{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;
            padding:7px;border:1px solid var(--divider-color);border-radius:8px;margin-bottom:6px;}
          .wc-arow.sel{border-color:var(--primary-color);background:rgba(127,127,127,.06);}
          .wc-arow select,.wc-arow input{padding:6px;border-radius:6px;font-size:12px;
            border:1px solid var(--divider-color);background:var(--card-background-color);
            color:var(--primary-text-color);width:100%;box-sizing:border-box;}
          .wc-arow .grip{cursor:pointer;color:var(--secondary-text-color);}
          .wc-arow .cols{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
          .wc-del{border:none;background:transparent;color:var(--error-color,#e53935);cursor:pointer;}
          .wc-hint{font-size:11.5px;color:var(--secondary-text-color);line-height:1.45;margin:4px 0 8px;}
        </style>
        <div class="wc-ed">
          <div class="wc-prev"><span class="tag">Prévia ao vivo</span><div class="holder"></div></div>
          <div class="wc-auto">
            <select class="areasel"></select>
            <button class="wc-btn fill"><ha-icon icon="mdi:auto-fix"></ha-icon>Montar a janela sozinho</button>
          </div>
          <div class="wc-tabs" role="tablist"></div>
          <div class="wc-body"></div>
        </div>`;

      const tabs = this.querySelector(".wc-tabs");
      const body = this.querySelector(".wc-body");
      TABS.forEach((t, i) => {
        const b = document.createElement("button");
        b.className = "wc-tab";
        b.type = "button";
        b.setAttribute("role", "tab");
        b.setAttribute("aria-selected", String(i === 0));
        b.dataset.id = t.id;
        b.innerHTML = `<ha-icon icon="${t.icon}"></ha-icon>${t.label}`;
        b.addEventListener("click", () => this._tab(t.id));
        tabs.appendChild(b);
        const pane = document.createElement("div");
        pane.className = `wc-pane${i === 0 ? " on" : ""}`;
        pane.dataset.id = t.id;
        body.appendChild(pane);
      });

      this._buildPane("janela");
      this._buildPane("panos");
      this._buildPane("clima");
      this._buildPane("extras");
      this._buildPane("paisagem");
      this._buildPane("estilo");
      this._buildPane("textos");

      // prévia: o card de verdade, alimentado pelo mesmo hass
      const holder = this.querySelector(".holder");
      this._preview = document.createElement("mw-window-curtain-card");
      holder.appendChild(this._preview);

      const sel = this.querySelector(".areasel");
      sel.addEventListener("change", () => { this._area = sel.value; });
      this.querySelector(".fill").addEventListener("click", () => this._autofill());
    }

    _tab(id) {
      this.querySelectorAll(".wc-tab").forEach((b) =>
        b.setAttribute("aria-selected", String(b.dataset.id === id)));
      this.querySelectorAll(".wc-pane").forEach((p) => p.classList.toggle("on", p.dataset.id === id));
    }

    _pane(id) { return this.querySelector(`.wc-pane[data-id="${id}"]`); }

    _form(id, pane) {
      const f = document.createElement("ha-form");
      f.computeLabel = (s) => LABELS[s.name] || s.name;
      f.addEventListener("value-changed", (ev) => this._onForm(ev, id));
      pane.appendChild(f);
      this._forms[id] = f;
      return f;
    }

    _sec(pane, text) {
      const d = document.createElement("div");
      d.className = "wc-sec";
      d.textContent = text;
      pane.appendChild(d);
      return d;
    }

    _hint(pane, html) {
      const d = document.createElement("div");
      d.className = "wc-hint";
      d.innerHTML = html;
      pane.appendChild(d);
    }

    _buildPane(id) {
      const p = this._pane(id);
      if (id === "janela") {
        this._hint(p, "As janelas da casa têm <b>uma folha fixa e uma que o empurrador movimenta</b>. " +
          "A da sala tem quatro: as das pontas são fixas de fábrica e as duas do meio correm — nesse " +
          "caso preencha os <b>dois</b> empurradores e escolha «para os lados».");
        this._form("janela", p);
      } else if (id === "panos") {
        this._form("panos", p);
        this._sec(p, "Tom de papel da cortina");
        const sw = document.createElement("div");
        sw.className = "wc-sw";
        sw.dataset.target = "curtain_paper";
        p.appendChild(sw);
        this._sec(p, "Tom de papel do blackout");
        const sw2 = document.createElement("div");
        sw2.className = "wc-sw";
        sw2.dataset.target = "blackout_paper";
        p.appendChild(sw2);
      } else if (id === "clima") {
        this._hint(p, "A cor da temperatura e da umidade no rodapé é a <b>escala canônica da casa</b> " +
          "— a mesma dos gauges e dos button-cards. Os limiares abaixo decidem qual efeito aparece no vidro.");
        this._form("clima", p);
      } else if (id === "extras") {
        this._hint(p, "Clique no quadro para <b>largar</b> um acessório e arraste o pino para acertar o lugar. " +
          "O retângulo é a janela; a área em volta é a parede, onde ficam as tomadas e o tubo do ar.");
        const pad = document.createElement("div");
        pad.className = "wc-pad";
        pad.innerHTML = `<div class="win"></div>`;
        p.appendChild(pad);
        this._pad = pad;
        pad.addEventListener("pointerdown", (ev) => this._padDown(ev));
        const bar = document.createElement("div");
        bar.className = "wc-auto";
        bar.innerHTML = `<button class="wc-btn ghost add"><ha-icon icon="mdi:plus"></ha-icon>Acrescentar acessório</button>`;
        p.appendChild(bar);
        bar.querySelector(".add").addEventListener("click", () => this._addAcc());
        const list = document.createElement("div");
        list.className = "wc-alist";
        p.appendChild(list);
        this._sec(p, "Tubo de ar-condicionado");
        this._form("extras", p);
      } else if (id === "paisagem") {
        this._form("paisagem", p);
      } else if (id === "textos") {
        this._hint(p, "Tamanho e cor de cada texto do card. <b>Cor vazia</b> segue a tinta do " +
          "papel — clara no papel escuro, escura no claro —, que é o que mantém dois cards MW " +
          "lado a lado parecendo da mesma casa. A fonte vale para o card inteiro.");
        this._form("textos", p);
      } else if (id === "estilo") {
        this._sec(p, "Tom de papel do card");
        const sw = document.createElement("div");
        sw.className = "wc-sw";
        sw.dataset.target = "paper";
        p.appendChild(sw);
        this._form("estilo", p);
      }
    }

    /* ---------------------------- esquemas ---------------------------- */

    _schemaFor(id) {
      const hass = this._hass;
      const cfg = this._cfg;
      const num = (min, max, unit) => ({ number: { min, max, step: 1, mode: "box", unit_of_measurement: unit || "px" } });
      const sel = (options) => ({ select: { mode: "dropdown", options } });
      const covers = () => entOptions(hass, (id2) => isCover(hass, id2), true);
      const opens = () => entOptions(hass, (id2) => id2.startsWith("binary_sensor."), true);

      if (!hass) return [{ name: "name", selector: { text: {} } }];

      if (id === "janela") return [
        { name: "name", selector: { text: {} } },
        { name: "panes", selector: sel(OPT.panes) },
        { name: "slide", selector: sel(OPT.slide) },
        { name: "opener", selector: sel(covers()) },
        ...(cfg.panes === 4 ? [{ name: "opener_right", selector: sel(covers()) }] : []),
        { name: "invert_position", selector: { boolean: {} } },
        { name: "", type: "expandable", title: "Sensores de abertura", schema: [
          { name: "sensor_left", selector: sel(opens()) },
          { name: "sensor_right", selector: sel(opens()) },
          { name: "sensor_invert", selector: { boolean: {} } },
          { name: "sensor_style", selector: sel(OPT.sensor_style) },
          ...(cfg.sensor_style === "line" || cfg.sensor_style === "both" ? [
            { name: "sensor_line_width", selector: num(1, 20) },
            { name: "sensor_line_inset", selector: num(0, 30) },
          ] : []),
        ] },
        { name: "", type: "expandable", title: "Controles e ações", schema: [
          { name: "controls", selector: sel(OPT.controls) },
          { name: "control_labels", selector: { boolean: {} } },
          { name: "controls_inset", selector: num(0, 40) },
          { name: "tap_action", selector: sel(OPT.actions) },
          { name: "hold_action", selector: sel(OPT.actions) },
          { name: "navigation_path", selector: { text: {} } },
          { name: "drag_target", selector: sel(OPT.drag_target) },
          { name: "confirm_accessory", selector: { boolean: {} } },
        ] },
      ];

      if (id === "panos") return [
        { name: "curtain", selector: sel(covers()) },
        { name: "curtain_open_from", selector: sel(OPT.curtain_open_from) },
        { name: "curtain_texture", selector: sel(OPT.curtain_texture) },
        { name: "curtain_dark", selector: { boolean: {} } },
        { name: "curtain_rod", selector: { boolean: {} } },
        { name: "", type: "expandable", title: "Tamanho da cortina e do varão", schema: [
          { name: "curtain_overhang", selector: num(0, 60) },
          { name: "curtain_top", selector: num(0, 40) },
          { name: "curtain_drop", selector: num(0, 60) },
          { name: "rod_offset", selector: num(0, 40) },
          { name: "rod_extend", selector: num(0, 60) },
          { name: "rod_thickness", selector: { number: { min: 1, max: 16, step: 0.5, mode: "box" } } },
        ] },
        { name: "blackout", selector: sel(covers()) },
        { name: "blackout_dark", selector: { boolean: {} } },
      ];

      if (id === "clima") return [
        { name: "temperature", selector: { entity: { domain: "sensor", device_class: "temperature" } } },
        { name: "humidity", selector: { entity: { domain: "sensor", device_class: "humidity" } } },
        { name: "battery", selector: { entity: { domain: "sensor", device_class: "battery" } } },
        { name: "battery_auto", selector: { boolean: {} } },
        { name: "show_footer", selector: { boolean: {} } },
        { name: "chips_position", selector: sel(OPT.chips_position) },
        ...(cfg.chips_position === "watermark" ? [
          { name: "watermark_align", selector: sel(OPT.watermark_align) },
          { name: "watermark_opacity", selector: { number: { min: 0.1, max: 1, step: 0.05, mode: "box" } } },
        ] : []),
        { name: "", type: "expandable", title: "Efeito no vidro", schema: [
          { name: "fx", selector: sel(OPT.fx) },
          { name: "fx_hot", selector: num(0, 50, "°C") },
          { name: "fx_cold", selector: num(-10, 30, "°C") },
          { name: "fx_rain", selector: num(0, 100, "%") },
          { name: "fx_dew", selector: num(0, 100, "%") },
          { name: "weather_entity", selector: { entity: { domain: "weather" } } },
        ] },
      ];

      if (id === "extras") return [
        { name: "ac_duct", selector: sel(OPT.ac_duct) },
        { name: "ac_entity", selector: { entity: {} } },
      ];

      if (id === "paisagem") return [
        { name: "scenery", selector: sel(OPT.scenery) },
        ...(cfg.scenery === "painted" || !cfg.scenery
          ? [{ name: "scenery_skyline", selector: sel(OPT.scenery_skyline) }] : []),
        ...(cfg.scenery === "image" ? [{ name: "scenery_image", selector: { text: {} } }] : []),
        ...(cfg.scenery === "image_by_time" ? [
          { name: "scenery_image_dawn", selector: { text: {} } },
          { name: "scenery_image_day", selector: { text: {} } },
          { name: "scenery_image_dusk", selector: { text: {} } },
          { name: "scenery_image_night", selector: { text: {} } },
        ] : []),
        { name: "badges", selector: sel(OPT.badges) },
        { name: "sun_entity", selector: { entity: { domain: "sun" } } },
        { name: "animate", selector: { boolean: {} } },
      ];

      if (id === "textos") {
        const par = (n) => [
          { name: `font_${n}`, selector: { number: { min: 6, max: 60, step: 1, mode: "box", unit_of_measurement: "px" } } },
          { name: `color_${n}`, selector: { text: {} } },
        ];
        return [
          { name: "font_family", selector: { text: {} } },
          ...par("title"), ...par("summary"),
          { name: "font_badge", selector: { number: { min: 8, max: 40, step: 1, mode: "box", unit_of_measurement: "px" } } },
          { name: "", type: "expandable", title: "Pastilhas e controles", schema: [
            ...par("chip"), ...par("control"), ...par("percent"),
          ] },
          { name: "", type: "expandable", title: "Acessórios e marca d'água", schema: [
            ...par("accessory"), ...par("watermark"),
          ] },
        ];
      }

      // estilo
      return [
        { name: "paper_dark", selector: { boolean: {} } },
        { name: "depth", selector: sel(OPT.depth) },
        { name: "border_style", selector: sel(OPT.border_style) },
        ...(cfg.border_style === "soft" || cfg.border_style === "glow" ? [
          { name: "border_width", selector: num(1, 24) },
          { name: "border_color", selector: { text: {} } },
          { name: "hover_glow", selector: { boolean: {} } },
        ] : []),
        ...(cfg.border_style === "glow"
          ? [{ name: "border_glow", selector: { number: { min: 0, max: 1, step: 0.05, mode: "box" } } }]
          : []),
        { name: "frame_tone", selector: sel(OPT.frame_tone) },
        { name: "scene_height", selector: num(120, 420) },
        { name: "padding", selector: num(0, 40) },
        { name: "", type: "expandable", title: "Cantos (o arredondamento de cada ponta)", schema: [
          { name: "radius_tl", selector: num(0, 80) },
          { name: "radius_tr", selector: num(0, 80) },
          { name: "radius_br", selector: num(0, 80) },
          { name: "radius_bl", selector: num(0, 80) },
        ] },
        { name: "", type: "expandable", title: "Cabeçalho", schema: [
          { name: "show_header", selector: { boolean: {} } },
          { name: "show_summary", selector: { boolean: {} } },
        ] },
      ];
    }

    _syncForms() {
      const data = { ...DEFAULTS, ...this._cfg };
      delete data.accessories;
      for (const k of Object.keys(data)) if (data[k] === "") delete data[k];
      for (const [id, f] of Object.entries(this._forms)) {
        f.hass = this._hass;
        f.schema = this._schemaFor(id);
        f.data = data;
      }
      const sel = this.querySelector(".areasel");
      if (sel && this._hass && !sel.dataset.filled) {
        const opts = areaOptions(this._hass);
        sel.innerHTML = `<option value="">— escolha o ambiente —</option>` +
          opts.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("");
        sel.dataset.filled = "1";
        if (this._cfg.area) sel.value = this._cfg.area;
        this._area = sel.value;
      }
    }

    /* --------------------------- amostras de papel --------------------------- */

    _paintSwatches() {
      this.querySelectorAll(".wc-sw").forEach((grid) => {
        const target = grid.dataset.target;
        const dark = target === "paper" ? this._cfg.paper_dark === true
          : target === "curtain_paper" ? this._cfg.curtain_dark === true
          : this._cfg.blackout_dark !== false;
        const cur = this._cfg[target] ?? DEFAULTS[target] ?? "";
        const key = `${dark}|${cur}`;
        if (grid.dataset.key === key) return;
        grid.dataset.key = key;
        const grad = dark ? paperDarkGradient : paperGradient;
        const hues = dark ? PAPER_DARK_HUES : PAPER_HUES;
        let html = "";
        const chip = (val, label) =>
          `<button type="button" class="wc-chip" data-v="${esc(val)}" title="${esc(label)}"
             aria-pressed="${String(val === cur)}" style="background:${grad(val)}"></button>`;
        if (target !== "paper") {
          html += `<b>Sem tom próprio</b><button type="button" class="wc-chip" data-v=""
            title="Usar o papel do card" aria-pressed="${String(!cur)}"
            style="background:repeating-linear-gradient(45deg,#8888,#8888 4px,#0000 4px,#0000 8px)"></button>`;
        }
        html += `<b>Neutro</b>${chip("paper", dark ? "Grafite" : "Creme")}`;
        for (const h of hues) {
          html += `<b>${h[1]}</b>`;
          for (let i = 1; i <= 7; i++) html += chip(`${h[0]}-${i}`, `${h[1]} tom ${i}`);
        }
        html += `<b>Grafite</b>`;
        for (let i = 1; i <= 7; i++) html += chip(`grafite-${i}`, `Grafite tom ${i}`);
        grid.innerHTML = html;
        grid.querySelectorAll(".wc-chip").forEach((b) => {
          b.addEventListener("click", () => this._set(target, b.dataset.v));
        });
      });
    }

    /* ----------------------------- acessórios ----------------------------- */

    _accs() { return Array.isArray(this._cfg.accessories) ? this._cfg.accessories : []; }

    _addAcc(at) {
      const list = this._accs().slice();
      list.push({ type: "socket", entity: "", x: at ? at.x : 8, y: at ? at.y : 70, size: 24 });
      this._sel = list.length - 1;
      this._set("accessories", list);
    }

    _updAcc(i, patch) {
      const list = this._accs().slice();
      if (!list[i]) return;
      list[i] = { ...list[i], ...patch };
      this._set("accessories", list);
    }

    _paintAccList() {
      const list = this._accs();
      const box = this.querySelector(".wc-alist");
      if (!box) return;

      // pinos no quadro
      if (this._pad) {
        [...this._pad.querySelectorAll(".wc-pin")].forEach((p) => p.remove());
        list.forEach((a, i) => {
          const t = ACC_TYPES.find((x) => x.value === a.type) || ACC_TYPES[0];
          const pin = document.createElement("div");
          pin.className = `wc-pin${i === this._sel ? " sel" : ""}`;
          pin.dataset.i = String(i);
          pin.style.left = `${clamp(numOr(a.x, 50), 0, 100)}%`;
          pin.style.top = `${clamp(numOr(a.y, 50), 0, 100)}%`;
          pin.innerHTML = `<ha-icon icon="${t.icon}"></ha-icon>`;
          this._pad.appendChild(pin);
        });
      }

      const sig = JSON.stringify(list) + `|${this._sel}`;
      if (box.dataset.sig === sig) return;
      box.dataset.sig = sig;

      box.innerHTML = list.map((a, i) => `
        <div class="wc-arow${i === this._sel ? " sel" : ""}" data-i="${i}">
          <ha-icon class="grip" icon="${esc((ACC_TYPES.find((x) => x.value === a.type) || ACC_TYPES[0]).icon)}"></ha-icon>
          <div>
            <div class="cols">
              <select data-f="type">${ACC_TYPES.map((t) =>
                `<option value="${t.value}"${t.value === a.type ? " selected" : ""}>${esc(t.label)}</option>`).join("")}</select>
              <input data-f="entity" placeholder="entidade (opcional)" value="${esc(a.entity || "")}">
            </div>
            <div class="cols" style="margin-top:6px">
              <input data-f="label" placeholder="rótulo" value="${esc(a.label || "")}">
              <input data-f="size" type="number" min="10" max="80" placeholder="tamanho" value="${esc(a.size ?? 24)}">
            </div>
          </div>
          <button class="wc-del" data-del="${i}" title="Remover"><ha-icon icon="mdi:close"></ha-icon></button>
        </div>`).join("") || `<div class="wc-hint">Nenhum acessório ainda.</div>`;

      box.querySelectorAll(".wc-arow").forEach((row) => {
        const i = Number(row.dataset.i);
        row.addEventListener("click", (ev) => {
          if (ev.target.closest("input,select,button")) return;
          this._sel = i;
          this._paintAccList();
        });
        row.querySelectorAll("[data-f]").forEach((inp) => {
          inp.addEventListener("change", () => {
            const f = inp.dataset.f;
            let v = inp.value;
            if (f === "size") v = clamp(numOr(v, 24), 10, 80);
            this._updAcc(i, { [f]: v });
          });
        });
      });
      box.querySelectorAll("[data-del]").forEach((b) => {
        b.addEventListener("click", () => {
          const i = Number(b.dataset.del);
          const l = this._accs().slice();
          l.splice(i, 1);
          this._sel = null;
          this._set("accessories", l);
        });
      });
    }

    // clique no vazio larga um acessório ali; clique num pino começa o arrasto
    _padDown(ev) {
      const rect = this._pad.getBoundingClientRect();
      const at = (e) => ({
        x: Math.round(clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100)),
        y: Math.round(clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100)),
      });
      const pin = ev.target.closest(".wc-pin");
      if (!pin) { this._addAcc(at(ev)); return; }
      ev.preventDefault();
      const i = Number(pin.dataset.i);
      this._sel = i;
      pin.style.cursor = "grabbing";
      const move = (e) => {
        const p = at(e);
        pin.style.left = `${p.x}%`;
        pin.style.top = `${p.y}%`;
      };
      const up = (e) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        // uma gravação só, no fim do arrasto: config-changed a cada pixel
        // reconstrói a prévia e engasga
        this._updAcc(i, at(e));
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    }

    /* ------------------------------ prévia ------------------------------ */

    _paintPreview() {
      if (!this._preview || !this._hass) return;
      try {
        this._preview.setConfig({ ...this._cfg });
        this._preview.hass = this._hass;
        this._preview.style.opacity = "1";
      } catch (e) {
        // configuração ainda incompleta: a prévia espera, o editor segue
        this._preview.style.opacity = ".35";
      }
    }

    /* --------------------------- preenchimento --------------------------- */

    _autofill() {
      if (!this._hass || !this._area) return;
      const found = discoverForArea(this._hass, this._area);
      this._config = { ...this._cfg, area: this._area, ...found };
      this._emit();
      this._render();
    }

    /* --------------------------- gravação --------------------------- */

    _set(key, value) {
      const c = { ...this._cfg };
      if (value === "" || value === undefined || value === null || value === "__none__") delete c[key];
      else c[key] = value;
      this._config = c;
      this._emit();
      this._render();
    }

    _onForm(ev, id) {
      ev.stopPropagation();
      const v = ev.detail.value || {};
      const clean = { ...this._cfg };
      for (const [k, val] of Object.entries(v)) {
        if (!(k in DEFAULTS)) continue;
        if (val === undefined || val === null || val === "" || val === "__none__") { delete clean[k]; continue; }
        if (val === DEFAULTS[k]) delete clean[k]; else clean[k] = val;
      }
      // campo que existe no esquema e sumiu do valor foi limpo pelo usuário
      const names = [];
      const walk = (s) => s.forEach((f) => (f.type === "expandable" ? walk(f.schema) : names.push(f.name)));
      walk(this._schemaFor(id));
      for (const n of names) {
        if (n && !(n in v) && n in clean && n !== "accessories") delete clean[n];
      }
      this._config = clean;
      this._emit();
      this._render();
    }

    _emit() {
      this.dispatchEvent(new CustomEvent("config-changed",
        { bubbles: true, composed: true, detail: { config: this._cfg } }));
    }
  }

  customElements.define("mw-window-curtain-card", MwWindowCurtainCard);
  customElements.define("mw-window-curtain-card-editor", MwWindowCurtainCardEditor);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "mw-window-curtain-card",
    name: "MW Window / Curtain Card",
    description: "A janela inteira: folhas de vidro, empurrador, cortina, blackout, exaustor, tomadas e a paisagem lá fora.",
    preview: true,
    documentationURL: "https://github.com/visaodeempresa/mw-ha-window-curtain-card",
  });

  console.info("%c MW-WINDOW-CURTAIN-CARD %c 0.3.0 ",
    "background:#1a1a1a;color:#fdfaf3;font-weight:700;",
    "background:#7ec8f2;color:#1a1a1a;font-weight:700;");

  // Só o probe headless usa isto — no navegador `module` não existe e a linha
  // é ignorada. Existe para o teste conferir DEFAULTS contra o editor sem ter
  // de reimplementar a tabela de campos do lado de fora.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { DEFAULTS, LABELS, TEXTURES, discoverForArea, paperGradient, paperDarkGradient };
  }
})();
