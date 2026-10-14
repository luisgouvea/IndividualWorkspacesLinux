# IndividualWorkspacesLinux

Extensão **Workspaces por monitor** para Ubuntu 24.04 / GNOME 46 (Wayland).

Cada monitor tem os seus próprios workspaces, como no macOS. Trocar o workspace
de um monitor **não mexe no outro**, e a navegação para no primeiro e no
último, sem dar a volta.

```
Monitor 1: [WS1] [WS2] [WS3]      Monitor 2: [WS1] [WS2] [WS3]
     ↑ troca aqui                       ↑ não se mexe
```

Substitui a "Switch workspaces on active monitor" (micheledaros). Com ela,
organizar janelas no Overview de um monitor bagunçava os workspaces do outro.

## Como funciona

O GNOME só tem **um** workspace ativo para todos os monitores, então isto é
uma simulação. O truque é o *carrossel*:

- São **5 workspaces globais** para ter 3 por monitor (a regra é `2n − 1`).
  O global ativo fica **sempre no do meio**.
- Trocar o workspace de um monitor move só as janelas **daquele** monitor
  entre os globais. O global não muda, então nada desliza e o outro monitor não
  é tocado.
- Com o ativo fixo no meio, as miniaturas do Overview de cada monitor ficam na
  ordem certa, centradas no workspace atual dele.

## Instalação

```bash
git clone https://github.com/luisgouvea/IndividualWorkspacesLinux.git ~/IndividualWorkspacesLinux
cd ~/IndividualWorkspacesLinux
./instalar.sh
```

O instalador faz quatro coisas:

1. Guarda a sua configuração de workspaces atual.
2. Desativa as extensões que disputam os workspaces (micheledaros, Smart
   Workspace Manager e Maximize Window Into New Workspace).
3. Configura 5 workspaces fixos, abrangendo as telas.
4. Habilita a extensão.

Depois, **faça logout e login**: no Wayland, extensão nova só carrega em sessão
nova.

**Atualizar:** `git pull && ./instalar.sh`. A reinstalação **mantém** o número
de workspaces que você escolheu.

**Mudar o número de workspaces:**

- Em Configurações → Multitarefa, use um **número ímpar**: 5 (3 por monitor),
  7 (4 por monitor), 9 (5 por monitor). Com número par, a extensão avisa e fica
  parada.
- Ou pelo instalador: `POR_MONITOR=5 ./instalar.sh` dá 9.

**Desfazer:** `./desinstalar.sh` remove a extensão, restaura a configuração
anterior e religa o que o instalador desativou.

## Qual monitor troca

| Ação | Monitor que troca |
|---|---|
| `Super+PageUp/PageDown`, `Ctrl+Alt+←/→`, atalhos numerados | o da janela em foco (sem foco, o do ponteiro) |
| `Super+Shift+PageUp/PageDown` (levar a janela junto) | o da janela |
| Overview: **um clique** numa miniatura | o daquela miniatura, e o Overview fecha (como no macOS) |
| Overview: clicar numa janela dentro da miniatura | o dela, que já abre em foco |
| Overview: rolar sobre as miniaturas | o do ponteiro |
| Gesto do Magic Mouse (`workspace-switch@local`) | o do ponteiro, sem mudar nada no outro repositório |
| Gesto de 3 dedos do touchpad | o do ponteiro, e o Overview abre no workspace à vista |
| Alt+Tab, dock e notificação para uma janela de outro workspace | o da janela escolhida |

## Workspaces dinâmicos por monitor

Cada monitor arruma a própria fila sozinho, no espírito dos workspaces
dinâmicos do GNOME:

- **Workspace que fica vazio some na hora**, e os da direita andam uma
  posição. Isso vale para fechar a última janela, mandá-la para outro monitor
  ou movê-la de workspace.
  - Se ele esvaziou na sua frente, o da direita entra no lugar. Exemplo: você
    está no WS2 e fecha a última janela dele; o antigo WS3 passa a ser o WS2,
    à vista.
  - Se era o último ocupado, você vai para o da esquerda.
  - Se o buraco ficou atrás de você, o que está à vista não muda, e o foco
    também não.
- **Sempre há um vazio no fim**, para abrir coisa nova. A navegação para a
  direita (atalho, gesto, miniatura) para nele.

O modo dinâmico nativo do GNOME não pode ser ligado, porque ele mexe nos
workspaces de todos os monitores juntos. Ele também nunca remove o workspace
em que você está; esta extensão remove na hora.

## Aviso de workspace

Ao trocar de workspace, o monitor que trocou mostra por 0,6 s a mesma fileira
de pontinhos do GNOME (`○ ● ○`), com os workspaces **daquele monitor**. O
ponto cheio é o atual.

- **Usa o visual do próprio tema**, não recebe clique e some sozinho.
- **Aparece só quando você navega:** atalho, gesto ou clique numa miniatura.
- **Não aparece quando a extensão mexe sozinha:** ao maximizar ou quando um
  workspace vazio some.
- **Na ponta,** aparece sem mudar nada, avisando que não dá para ir além.

## Maximizar

Como a tela cheia do macOS, mas só para **maximizar** (botão, duplo clique no
título ou `Super+↑`).

- **Onde a janela vai:** para um workspace novo **logo à direita** do atual,
  só naquele monitor. Os workspaces ocupados que estavam ali são **empurrados**
  uma posição para a direita. Exemplo: WS1 = A+B, WS2 = C, WS3 vazio.
  Maximizar A deixa WS1 = B, WS2 = A e WS3 = C.
- **Limite:** cada monitor tem um número fixo de workspaces. O empurrão usa o
  vazio do fim; se todos estiverem ocupados, maximiza no lugar.
- **Desmaximizar ou fechar:** o workspace da janela **some** e os da direita
  voltam uma posição, como no macOS.
  - Ao desmaximizar, a janela volta ao workspace de onde veio, e o monitor vai
    junto.
  - Ao fechar, se você estava nele, o monitor volta à origem.
- **O que não muda:** o outro monitor. Também ficam no lugar a janela que já
  está sozinha, a tela cheia (F11, vídeo) e a meia tela (`Super+←/→`).

Com 3 workspaces por monitor, a vaga acaba rápido. Mais workspaces dão mais
espaço (veja "Mudar o número de workspaces").

A extensão "Maximize Window Into New Workspace" conflita com esta: ela
reordena os workspaces e bagunça o outro monitor. O instalador a desliga.

## Limitações

- A janela dos ícones da área de trabalho (Desktop Icons NG, que aparece como
  "gjs") nunca é movida. O DING precisa que ela apareça logo depois de criada:
  se ela sai da tela antes de ele reconhecê-la, ele mata e relança o processo
  a cada 6 s, e um ícone "gjs" fica abrindo e fechando no dock.
- O indicador de workspaces do GNOME (os pontinhos do Activities) mostra sempre
  o do meio.
- Nas miniaturas aparecem workspaces vazios além das pontas. Uma janela solta
  ali é puxada para o primeiro ou para o último.
- Uma troca de workspace iniciada fora do Shell, por exemplo um app que pede
  foco numa janela de outro workspace, ainda passa pelo workspace global. A
  extensão a corrige antes do desenho seguinte, levando só o monitor da janela
  focada. Se a animação de troca de workspace estiver ligada, pode aparecer um
  deslize rápido; a extensão "Disable Workspace Animation" resolve.
- Na instalação, janelas que estavam além do 3º workspace vão para o 3º.
- Com dois monitores, o gesto de 3 dedos do touchpad desliza os dois enquanto
  os dedos se movem; ao soltar, só o do ponteiro troca e o outro volta.
- Só GNOME 46.

## Diagnóstico

```bash
gnome-extensions info workspaces-por-monitor@luisgouvea
journalctl --user -f -o cat | grep workspaces-por-monitor
```

Se a configuração não servir (workspaces dinâmicos, só no monitor principal ou
total par), a extensão fica parada, avisa numa notificação e deixa tudo com o
GNOME.

## Desenvolvimento

```bash
npm test
```

São duas suítes:

- **`nucleo.test.js`**: a lógica pura (`extensao/…/nucleo.js`).
- **`teste/extensao.test.js`**: roda a extensão de verdade sobre um GNOME
  falso em Node (`teste/gnome-falso/`), com dois monitores, janelas e
  workspaces simulados.

O teste final é sempre numa sessão GNOME real, com o checklist abaixo:

- [ ] Atalho com o foco no monitor 1 e o ponteiro no 2: só o 1 troca.
- [ ] Gesto do Magic Mouse: só o monitor do ponteiro troca.
- [ ] Com dois monitores, trocar pelo Magic Mouse e pelo teclado e abrir as
      miniaturas pelo teclado: cada monitor mostra o próprio workspace atual.
      Um swipe do Magic Mouse dentro delas troca só o monitor do ponteiro.
- [ ] Gesto de 3 dedos no touchpad e depois abrir o Overview: a miniatura em
      destaque é a do workspace atual, também depois de bater na ponta.
- [ ] Overview:
  - trocar de workspace lá dentro: as janelas do novo aparecem na hora, mesmo
    mexendo o ponteiro;
  - um clique numa miniatura já entra no workspace;
  - um clique numa janela dentro da miniatura já abre a janela;
  - arrastar uma janela para uma miniatura;
  - soltar uma janela numa miniatura vazia fora das pontas.
- [ ] Alt+Tab e dock para uma janela do outro monitor.
- [ ] `Super+Shift+PageDown` leva a janela junto.
- [ ] Com WS1 = duas janelas, WS2 = uma e WS3 vazio: maximizar no WS1 põe a
      janela sozinha no WS2 e empurra a do WS2 para o WS3, só naquele monitor.
- [ ] Desmaximizar desfaz o empurrão (a ordem volta); fechar também.
- [ ] F11 e `Super+←` não movem a janela.
- [ ] No WS1 e no vazio do fim, o atalho para.
- [ ] Trocar por atalho ou gesto mostra os pontinhos só no monitor que trocou,
      e eles somem sozinhos.
- [ ] Com WS1, WS2 e WS3 ocupados, estando no WS2, fechar a última janela dele:
      o antigo WS3 entra no lugar. Fechar a do último leva ao da esquerda.
- [ ] Arrastar uma janela de um monitor para o outro.
- [ ] Bloquear a tela, suspender e retomar, desconectar o monitor 2.
