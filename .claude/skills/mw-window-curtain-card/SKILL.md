---
name: mw-window-curtain-card
description: >
  Mexer no card de janela/cortina do Home Assistant (custom:mw-window-curtain-card).
  Use quando o Maycon falar em "MW Window", "card da janela", "a cortina no card",
  "o blackout não desce", "a janela não abre na tela", "o empurrador da sala",
  "põe o exaustor na janela", "tom de papel escuro da cortina", "a paisagem da
  janela", "chuva no vidro", ou quando pedir print/imagem nova para o README
  deste repositório. Para o elemento da planta, a skill é mw-picture-element.
---

# MW Window / Curtain Card

Arquivo único, sem build: `dist/mw-window-curtain-card.js` é fonte **e**
artefato. JS puro + `<ha-form>`. Instalação por HACS (categoria Dashboard).

Leia `memoria-ia/CONTEXTO.md` antes de mexer — está lá o mapa das janelas
reais da casa (quem tem 4 folhas, quem tem dois empurradores) e as armadilhas
com sintoma.

## Pré-condições

| Preciso de | Como obter | Se faltar |
|---|---|---|
| Bancada | `preview_start` com `mw-window-curtain-preview` (porta 8791) | sem conferência visual; dizer isso explicitamente |
| HTTP no HA | `curl -s -o /dev/null -w '%{http_code}' http://192.168.1.71:8123/` → `200` | usar a Nabu Casa |
| Entidades reais | `curl -H "Authorization: Bearer $HA_TOKEN" $HA_LOCAL_URL/api/states` com o `.env` de `ha-dashboards/` | não inventar entity_id nos exemplos |

## Fluxo

1. **Editar** `dist/mw-window-curtain-card.js`: default em `DEFAULTS`, rótulo
   pt-BR em `LABELS`, campo no `_schemaFor(<aba>)`. As três coisas, sempre —
   o probe reprova se faltar uma.
2. `node --check dist/mw-window-curtain-card.js`
3. `node tools/probe.js` — instancia card e editor sem navegador.
4. `IA/tools/check-embeds.sh` — os três blocos embutidos (`paper-palette v1`,
   `paper-dark-palette v1`, `mw-climate-scale v1`) têm de bater com `IA/lib/`.
5. **Olhar**: bancada em `/tools/preview.html` (cena) e
   `/tools/preview-editor.html` (editor). Mudou desenho? Screenshot.
6. Commit assinado (regra 00), branch `feature/**`, PR. **Merge é do dono.**

## Onde mexer em cada coisa

| Quero | Onde |
|---|---|
| geometria da janela | `SC`, `FR`, `GL`, `SILL` no topo |
| folha que corre | `paneSvg()` + `--t1/--t2` em `_paint()` |
| tecido novo | `TEXTURES` (rótulo, prega, brilho, filtro) |
| efeito no vidro | constantes `RAIN`/`DEW`/`EMBER`/`SNOW` + `.fx-*` no `_css()` |
| silhueta nova | `skylinePath()` + opção em `OPT.scenery_skyline` |
| tipo de acessório | `ACC_TYPES` + ícone em `_accessory()` |
| aba do editor | `TABS` + `_buildPane()` + `_schemaFor()` |

## Armadilhas

- **Crase em comentário dentro de `_css()`** fecha o template literal.
  Sintoma: `SyntaxError: Unexpected identifier` no `node --check`.
- **Remontou o shadow DOM? Zere as referências guardadas** (`_ctlEls`,
  `_accEls`, `_skyStops`, `_imgSrc`). Sintoma: pedaço do card congela sem
  nenhum erro no console.
- **O editor recebe `setConfig` antes do `hass`.** Sem refazer o `_render()`
  na primeira entrega do `hass`, o editor mostra só o campo «Nome».
- **Não invente faixa de cor para temperatura/umidade** — regra global 40, a
  escala é a canônica embutida.
- **Deploy de teste por SSH exige subir `.js` E `.js.gz`**; o `.gz` velho
  continua sendo servido e a tela não muda.

## Verificação (o que faz a tarefa estar pronta)

```bash
node --check dist/mw-window-curtain-card.js
node tools/probe.js                      # termina em "tudo certo."
IA/tools/check-embeds.sh                 # termina em "todos os blocos ... batem"
git log -1 --pretty='%G? %an'            # G + MAYCON WILLIAN OLIVEIRA
```

Conferência na tela do HA de verdade é do dono. Se não houve, **diga** — não
deixe implícito que houve teste (regra global 30).
