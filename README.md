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
nova. Para outro número por monitor, use `POR_MONITOR=4 ./instalar.sh`, que dá
7 globais.

**Desfazer:** `./desinstalar.sh` remove a extensão, restaura a configuração
anterior e religa o que o instalador desativou.

## Qual monitor troca

| Ação | Monitor que troca |
|---|---|
| `Super+PageUp/PageDown`, `Ctrl+Alt+←/→`, atalhos numerados | o da janela em foco (sem foco, o do ponteiro) |
| `Super+Shift+PageUp/PageDown` (levar a janela junto) | o da janela |
| Overview: clicar ou rolar nas miniaturas | o do ponteiro |
| Gesto do Magic Mouse (`workspace-switch@local`) | o do ponteiro, sem mudar nada no outro repositório |
| Alt+Tab, dock e notificação para uma janela de outro workspace | o da janela escolhida |

## Limitações

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
- O gesto de touchpad do próprio GNOME não é tratado.
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
- [ ] Overview:
  - clicar numa miniatura;
  - arrastar uma janela para uma miniatura;
  - soltar uma janela numa miniatura vazia fora das pontas.
- [ ] Alt+Tab e dock para uma janela do outro monitor.
- [ ] `Super+Shift+PageDown` leva a janela junto.
- [ ] No WS1 e no WS3, o atalho para.
- [ ] Arrastar uma janela de um monitor para o outro.
- [ ] Bloquear a tela, suspender e retomar, desconectar o monitor 2.
