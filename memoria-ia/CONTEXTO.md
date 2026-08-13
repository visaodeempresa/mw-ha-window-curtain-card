# Contexto — mw-ha-window-curtain-card

Mapa para a próxima sessão não redescobrir o que já custou descoberta.

## O que é

Card Lovelace que desenha a **janela inteira** do BASE-ALFA-01: esquadria com
2 ou 4 folhas, empurrador(es), 2 sensores de abertura, T/H com bateria,
cortina, blackout, exaustor, ventoinha solar, tubo de ar-condicionado,
tomadas e a paisagem lá fora. Nasceu em 12/08/2026 para substituir o
`custom:curtain-card` (fork em `visaodeempresa/lovelace-curtain-card`), que só
desenhava a cortina e exigia `card_mod` na mão para cor e cantos.

## A casa, como ela é de verdade

Levantado por `/api/states` em 12/08/2026 — **não é suposição**:

| Ambiente | Empurrador | Sensores | Cortina / Blackout |
|---|---|---|---|
| Sala | `cover.janela_esquerda_da_sala` **e** `cover.janela_direita_da_sala` | `binary_sensor.janela_{esquerda,direita}_da_sala` | `cover.cortina_da_sala` · `cover.blackout_da_sala` |
| Suíte | `cover.0xbc026efffe0b49f4` | `binary_sensor.suite_janela_{esquerda,direita}_da_suite` | `cover.cortina_da_suite` |
| Cozinha | `cover.janela_da_cozinha` | `binary_sensor.janela_{esquerda,direita}_da_cozinha` | — |
| Quarto | `cover.janela_do_quarto` | `binary_sensor.janela_{esquerda,direita}_do_quarto` | `cover.0xa4c1386cf98c2799` |
| Escritório | `cover.estado_da_janela_do_escritorio` | `binary_sensor.janela_{esquerda,direita}_do_escritorio` | `cover.blackout_do_escritorio` |

- **Só a sala tem 4 folhas** (duas fixas nas pontas, duas móveis no meio, um
  empurrador para cada). Todas as outras têm 2, com a folha correndo para a
  esquerda.
- Todos os empurradores são `cover` com `current_position` e
  `supported_features: 15` (abrir/fechar/posição/parar).
- Toda janela tem `sensor.temperatura_da_janela_<ambiente>` e
  `sensor.umidade_da_janela_<ambiente>` — o card prefere esses ao sensor
  genérico do cômodo, e é isso que o «Montar a janela sozinho» faz.
- Exaustores: `fan.exaustor_da_suite`, `fan.exaustor_da_cozinha`.

## Decisões de arquitetura

- **Montar uma vez, pintar por variável CSS.** `_build()` monta o SVG;
  `_paint()` só mexe em `--o1`, `--cur`, `--bo`, `--night` e em meia dúzia de
  nós de texto. Sem isso, cada atualização do HA reconstruiria a cena inteira.
- **A caixa da cena tem a proporção do viewBox** (`aspect-ratio`), porque os
  acessórios são HTML posicionado em % da caixa. Com a caixa mais larga que o
  SVG, o `preserveAspectRatio` centraliza o desenho e os acessórios descolam da
  janela. `scene_height` virou **teto**, convertido em limite de largura.
- **Pregas e ripas são paradas do gradiente**, não geometria. Como o gradiente
  é em caixa delimitadora, `scaleX`/`scaleY` no painel franze o pano e junta as
  ripas de graça — que é o que o tecido e a persiana fazem.
- **Sem montante fixo no meio.** Janela de correr divide o vidro pela esquadria
  de cada folha, que anda junto. O risco central ficava por cima da folha
  aberta.
- **`paper-dark-palette v1` é lib nova**, não parâmetro no `paper-palette`: o
  bloco claro já está embutido byte a byte em cinco cards publicados, e mexer
  nele reprovaria os cinco no `check-embeds.sh` até o último ser atualizado.

## Armadilhas (com sintoma observável)

| Sintoma | Causa | Correção |
|---|---|---|
| Controles congelam em «--» depois de mexer no editor | `_build()` remonta o shadow DOM e as referências guardadas (`_ctlEls`, `_accEls`, `_skyStops`) ficam apontando para nós soltos | zerar TODAS elas no começo do `_build()` |
| Editor mostra só o campo «Nome» e a prévia fica vazia | o HA chama `setConfig` **antes** do `hass`, e sem `hass` o esquema cai no campo único de reserva | na primeira entrega do `hass`, refazer o `_render()` inteiro |
| `SyntaxError: Unexpected identifier` no `node --check` | comentário com crase dentro de um template literal fecha a string | não usar crase em comentário dentro de `_css()` |
| Lua some nas janelas à noite | a lua estava pendurada na elevação do sol (−20° = abaixo do horizonte) | à noite a lua sobe pelo relógio, não pela elevação |
| Reflexo do vidro brilhando de madrugada | `.shine` com alfa fixo | `opacity: calc(1 - var(--night) * .78)` |
| Risco do sensor some quando a cortina tem sobra | o pano é desenhado depois e cobre a borda do vão | desenhar `${lines}` por ÚLTIMO, na frente de tudo |
| Nome vira «SALA · RI…» com os chips no topo | cabeçalho em linha única espremia o título | `.head{flex-wrap:wrap}` + `.titlewrap{flex:1 1 55%}` |
| Pastilhas da marca d'água se atropelando | lado a lado, com fonte grande, não cabem | empilhar (`flex-direction:column`) e tirar as de Esq./Dir. |
| Teste do halo passando por engano | a regex `0 0 Npx rgba(1…` casava com o brilho da tomada acesa | testar a **assinatura** da cor do halo, não o formato da sombra |
| Probe não enxerga classe nem variável CSS | `classList.contains` do dublê devolvia sempre `false` e `style` não tinha `getPropertyValue` | dublê com `Set` e `Map` de verdade (v0.2.0) |

## Bancadas

- `tools/preview.html` — 6 cenários (dia, noite, chuva, calor, frio, voil).
- `tools/preview-editor.html` — o editor com um `ha-form` dublê.
- Servidor registrado em `PROJECTS/.claude/launch.json` como
  `mw-window-curtain-preview` (porta 8791).
- `tools/probe.js` — card + editor sem navegador; roda no CI.

Nenhuma das bancadas é o HA: `ha-card` e `ha-icon` ali são dublês de duas
linhas, e os ícones aparecem como emoji.

## Pendente

- Conferência na tela do HA de verdade — é do dono (regra global 30).
- DevOps padrão (`IA/tools/mw-devops.sh apply`) para CI/auto-release/probe.
- `mw-ha-window-curtain-element` — o irmão para picture-elements, com menu de
  hexágonos.
