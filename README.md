<!-- MW-BRAND:BEGIN — gerado por IA/tools/mw-brand.sh · não editar à mão -->
<p align="center">
  <a href="https://github.com/visaodeempresa">
    <img src="docs/brand/logo.png" alt="Visão de Empresa — MAYCON WILLIAN OLIVEIRA" width="96">
  </a>
  <br>
  <sub><b>Visão de Empresa</b> · componente de Home Assistant por MAYCON WILLIAN OLIVEIRA</sub>
</p>
<!-- MW-BRAND:END -->

# MW Window / Curtain Card

[![CI](https://github.com/visaodeempresa/mw-ha-window-curtain-card/actions/workflows/ci.yml/badge.svg)](https://github.com/visaodeempresa/mw-ha-window-curtain-card/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/visaodeempresa/mw-ha-window-curtain-card?sort=semver)](https://github.com/visaodeempresa/mw-ha-window-curtain-card/releases)
[![HACS](https://img.shields.io/badge/HACS-Dashboard-41BDF5.svg)](https://hacs.xyz)

A **janela inteira** num card só — não a cortina de um lado e o sensor do
outro. A esquadria com as folhas de vidro que o empurrador movimenta, os dois
sensores de abertura, o sensor de temperatura/umidade com a bateria, a cortina,
o blackout, o exaustor, a ventoinha solar, o tubo do ar-condicionado, as
tomadas da parede — e a paisagem lá fora, que muda com a hora e com o que os
sensores estão dizendo agora.

![Seis janelas em estados diferentes](docs/exemplos.png)

Primeira fila: a **sala** de 4 folhas meio-abertas com cortina de linho,
blackout e tubo de ar dos dois lados; a **suíte** em papel violeta escuro, de
noite, com a cidade acesa lá fora e cortina de veludo; a **cozinha** com 33 °C
— o ar treme no vidro — e a ventoinha solar girando.

Segunda fila: o **quarto** com 86 % de umidade (chove, e a gota escorre no
vidro) e cortina de juta; o **escritório** a 9 °C com esquadria de alumínio; e
a **moldura suave com halo**, com a cor tirada sozinha do papel violeta.

Terceira fila: a moldura suave em papel claro; o **risco vertical** do sensor
(verde aberto, vermelho fechado) com as pastilhas no topo e a cortina sobrando
para fora do vão; e as pastilhas como **marca d'água** sobre o vidro, com
fonte serifada. Por último, uma sacada com cortina de **voil**, translúcida de
verdade.

Arquivo único, **sem build**: `dist/mw-window-curtain-card.js` é fonte e
artefato. JS puro + `<ha-form>` do Home Assistant, sem dependência externa.

## Por que ele existe

O `custom:curtain-card` (e o fork em
[lovelace-curtain-card](https://github.com/visaodeempresa/lovelace-curtain-card))
desenha a cortina e para por aí: as curvas das pontas eram feitas na mão em
`card_mod`, a cor não tinha de onde sair e a janela — o empurrador, os
sensores, o exaustor — ficava espalhada por outros quatro cards. Aqui é **uma
peça só**, com editor visual, tons de papel claro **e escuro**, relevo 3D e os
cantos configuráveis campo a campo, sem uma linha de `card_mod`.

## Instalação

### HACS (recomendado)

1. HACS → **⋮** → **Repositórios personalizados**
2. URL: `https://github.com/visaodeempresa/mw-ha-window-curtain-card` ·
   Categoria: **Dashboard**
3. Instalar **MW Window / Curtain Card** e recarregar a página (⌘⇧R / Ctrl+Shift+R).

### Manual

Copie `dist/mw-window-curtain-card.js` para `/config/www/` e cadastre o recurso
em **Configurações → Painéis → ⋮ → Recursos** como Módulo JavaScript apontando
para `/local/mw-window-curtain-card.js`.

## Uso mínimo

```yaml
type: custom:mw-window-curtain-card
opener: cover.janela_da_cozinha
```

Uma linha útil: a folha corre para a esquerda (o padrão da casa), a paisagem é
desenhada, o céu segue o `sun.sun` e o controle aparece sozinho.

## O editor faz o trabalho

Abra o card no editor visual e use **«Montar a janela sozinho»**: escolha o
ambiente e ele procura o empurrador, o segundo empurrador (se houver), os dois
sensores de abertura, o sensor de temperatura e o de umidade — preferindo
sempre o sensor *da janela* ao sensor genérico do cômodo —, a cortina, o
blackout, o exaustor e as tomadas. Tudo continua editável campo a campo depois.

O editor tem **prévia ao vivo** (o card de verdade, com o seu `hass`), seis
abas, **grade de amostras** com os 50 tons de papel desenhados de verdade — em
claro e em escuro — e um **quadro de acessórios**: clique para largar, arraste
o pino para acertar o lugar.

![O editor, com prévia ao vivo e seis abas](docs/editor.png)

A prévia responde a cada campo: trocar o tom de papel na grade de amostras
repinta o card ali em cima antes de você salvar.

## A janela

| Campo | O que faz |
|---|---|
| `panes` | `2` (uma fixa, uma que corre) ou `4` (as das pontas fixas, as duas do meio correm) |
| `slide` | `left` · `right` · `out` — para onde a folha corre |
| `opener` | o `cover` do empurrador |
| `opener_right` | o **segundo** empurrador, para a janela de 4 folhas |
| `sensor_left` / `sensor_right` | os dois `binary_sensor` de abertura |
| `invert_position` | para o `cover` que reporta 0 = aberto |

Janela de correr **não tem montante fixo no meio**: quem divide o vidro é a
esquadria de cada folha, que anda junto com ela. É por isso que a folha aberta
não fica com um risco atravessado.

### As quatro folhas da sala

As duas placas das pontas são fixas de fábrica e as duas do meio são puxadas
por um empurrador cada:

```yaml
type: custom:mw-window-curtain-card
name: JANELA DA SALA
panes: 4
slide: out
opener: cover.janela_esquerda_da_sala
opener_right: cover.janela_direita_da_sala
```

## Cortina e blackout

```yaml
curtain: cover.cortina_da_suite
curtain_open_from: sides        # sides | left | right
curtain_texture: veludo         # paper | linho | juta | veludo | seda | voil
curtain_paper: violet-4         # vazio = o mesmo papel do card
curtain_dark: true              # o tom escuro equivalente
blackout: cover.blackout_da_sala
```

As pregas são o próprio gradiente do pano: como ele acompanha a caixa do
painel, franzir a cortina **estreita as pregas sozinho** — é o que o tecido
faz. `voil` é translúcido de verdade (dá para ver a paisagem através dele), e
`linho` e `juta` têm trama (filtro SVG estático, sem custo por quadro).

## Clima, e o que aparece no vidro

`temperature` e `humidity` pintam o rodapé com a **escala canônica da casa** —
a mesma dos gauges e dos `button-card`, definida em
`IA/rules/global/40-cores-de-temperatura-e-umidade.md`. A bateria do sensor é
descoberta sozinha.

Os mesmos números decidem o efeito no vidro:

| Efeito | Quando (padrão) | O que se vê |
|---|---|---|
| `rain` | UR ≥ 78 %, ou a entidade de tempo diz chuva | riscos caindo lá fora e gotas escorrendo no vidro |
| `hot` | T ≥ 30 °C | ar tremendo e brasas subindo |
| `cold` | T ≤ 15 °C | gelo nos cantos do vidro e flocos caindo |
| `dew` | UR ≥ 62 % | condensação respirando no vidro |

Cada limiar é um campo (`fx_hot`, `fx_cold`, `fx_rain`, `fx_dew`), e `fx` pode
fixar um efeito ou desligar tudo.

## A paisagem

| `scenery` | O que é |
|---|---|
| `painted` | céu desenhado, sol/lua no arco da hora, estrelas piscando e silhueta (`cidade`, `morros`, `mar`, `campo`) |
| `image` | uma imagem fixa sua |
| `image_by_time` | uma imagem por fase do dia — amanhecer, dia, fim de tarde, noite |
| `none` | só o vidro sobre o fundo do card |

É a combinação que o dono pediu: **a imagem acompanha o horário** e
temperatura/umidade viram **carimbo de emoji** no cabeçalho (`badges`), em vez
de multiplicar imagens por faixa de sensor.

À noite a lua sobe pelo relógio, e não pela elevação do sol — pendurá-la onde o
sol está (a −20°) a esconderia embaixo do horizonte justo quando ela é a única
coisa que se quer ver.

## Acessórios

Uma lista de peças posicionadas em % sobre a cena. A janela ocupa o meio; a
margem em volta é a parede, onde ficam as tomadas.

```yaml
accessories:
  - type: exhaust                 # exaustor: gira quando ligado
    entity: fan.exaustor_da_suite
    x: 84
    y: 12
  - type: solar_fan               # não é inteligente: gira quando o sol está alto
    x: 88
    y: 20
  - type: socket
    entity: switch.tomada_da_janela
    x: 5
    y: 60
```

Tipos: `exhaust` · `mini_fan` · `solar_fan` · `socket` · `sensor` · `light` ·
`plant` · `other`. A **ventoinha solar não precisa de entidade** — quem a liga
é o sol.

O tubo do ar-condicionado é campo próprio, porque ele nasce da esquadria:
`ac_duct: none | left | right | both`, com `ac_entity` para o sopro animado.

## Arrastar, e perguntar antes

```yaml
drag_target: curtain       # none | opener | opener_right | curtain | blackout
confirm_accessory: true    # o acessório pergunta antes de acionar
```

Com `drag_target`, arrastar o dedo pela cena move a folha, a cortina ou o
blackout (esse na vertical). O desenho segue o dedo na hora e o serviço só é
chamado **ao soltar** — arrastar não vira uma enxurrada de chamadas ao HA. O
arrasto vence o toque: passou de 6 px, o `tap_action` não dispara.

A confirmação é um painel sobre a cena, com o nome do que vai acontecer
(«Desligar EXAUSTOR DA SUÍTE?»). Preferi isso a «toque duas vezes» porque
acessório é alvo pequeno: exigir pontaria duas vezes seria pior, não mais
seguro.

## Sensores: pastilha ou risco

```yaml
sensor_style: line         # pills (padrão) | line | both
sensor_line_width: 5
sensor_line_inset: 0
```

`line` desenha um risco vertical na borda do vão — **verde aberto, vermelho
fechado** —, que é a leitura de relance que a pastilha do rodapé não dá. O
risco é desenhado por último, na frente até da cortina: indicador que some
atrás do pano não indica nada.

## Onde ficam temperatura, umidade e bateria

```yaml
chips_position: watermark  # footer (padrão) | header | watermark
watermark_align: bottom-left
watermark_opacity: 0.55
font_watermark: 26
```

No rodapé, no topo junto dos emojis, ou como **marca d'água** sobre o vidro.
Na marca d'água as pastilhas empilham (lado a lado elas se atropelam) e as de
«Esq./Dir.» somem — para isso existe o risco vertical.

## A cortina cobre mais que a janela

Porque cortina de verdade cobre. Tudo em unidades do desenho — o vão tem 250
de largura por 166 de altura, então `12` é mais ou menos um palmo:

```yaml
curtain_overhang: 18   # sobra de cada lado
curtain_top: 10        # começa acima do vão
curtain_drop: 14       # desce abaixo do vão
rod_offset: 8          # sobe o varão
rod_extend: 26         # varão passando de cada lado
rod_thickness: 6
```

A cortina é desenhada **fora do recorte do vão e na frente da esquadria**, que
é onde o pano fica de verdade.

## Aparência

```yaml
paper: violet-5        # 49 tons de papel encardido + o creme
paper_dark: true       # a rampa escura equivalente, mesmas chaves
depth: 3d              # flat | soft | 3d
border_style: glow     # hairline (padrão) | soft | glow | none
border_width: 5
border_color: ''       # vazio = tirada do próprio tom de papel
hover_glow: true       # acende ao passar o mouse (desktop)
frame_tone: madeira    # auto | claro | escuro | branco | madeira | aluminio
radius_tl: 4
radius_bl: 52          # os cantos que antes eram card_mod na mão
controls_inset: 12     # recuo dos controles, para não bater na curva
scene_height: 300      # teto de altura; a largura segue a proporção
```

### A moldura suave, e o que ela custa

`border_style: soft` põe a moldura clara em volta do card, e `glow` acrescenta
o halo. A cor sai do **próprio papel**: mesma matiz, afastada em luminosidade
— no papel escuro ela clareia (é o lilás), no claro ela escurece. Por isso
não é preciso acertar a cor na mão a cada tom novo.

Sobre o peso, que é a pergunta certa a fazer: **a moldura é de graça**. Ela é
um `border` de verdade, acompanha o `border-radius` sozinho e é pintada uma
vez. O halo é um `box-shadow` estático — também pintado uma vez.

O que ficou **de fora de propósito**, e é o que pesa no `card_mod` equivalente:

- `backdrop-filter: blur(8px)` — custo por quadro, multiplicado por card na
  tela. É o item caro da lista, não a sombra.
- `transition: all 0.3s` — animaria a sombra a cada mudança de estado do HA,
  não só no hover. Aqui o `hover_glow` transiciona **apenas** `box-shadow` e
  `border-color`, e só do card sob o mouse.

## Textos

Uma aba inteira do editor: tamanho e cor de cada texto (nome, resumo,
pastilhas, rótulo do controle, porcentagem, acessório, marca d'água), mais a
família de fonte do card inteiro.

```yaml
font_family: "Georgia, 'Times New Roman', serif"
font_title: 16
color_title: '#7a4a12'
```

**Cor vazia segue a tinta do papel** — clara no papel escuro, escura no claro.
É o que mantém dois cards MW lado a lado parecendo da mesma casa.

## Desempenho

O que o dono pediu — bonito sem comprometer a tela:

- O SVG é montado **uma vez**. Estado do HA vira variável CSS
  (`--o1`, `--cur`, `--bo`, `--night`), não `innerHTML` novo.
- Toda animação é `transform`/`opacity` — trabalho de compositor, não de layout.
- As animações **pausam sozinhas** quando o card sai da tela
  (`IntersectionObserver`), e respeitam `prefers-reduced-motion`.
- Estrelas, gotas e brasas têm posição com semente fixa: não “pulam” de lugar a
  cada atualização do HA.
- Repintura só acontece quando a assinatura do estado muda de verdade.

## Verificação

```bash
node --check dist/mw-window-curtain-card.js
node tools/probe.js                 # instancia card e editor sem navegador
python3 -m http.server 8791         # e abrir /tools/preview.html
```

`tools/preview.html` é a bancada de desenho (dia, noite, chuva, calor, frio,
cortina no meio do caminho) e `tools/preview-editor.html` é a bancada do
editor. Nenhuma das duas é o Home Assistant: `ha-card` e `ha-icon` ali são
dublês.

## Licença

MIT — veja [LICENSE](LICENSE).
