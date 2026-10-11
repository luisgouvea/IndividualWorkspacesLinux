import {test, afterEach} from 'node:test';
import assert from 'node:assert/strict';

import {
    estado,
    montarCenario,
    desenhar,
    janela,
    focar,
    apertar,
    aVista,
    indiceAtivo,
    Workspace,
    ativarPeloMutter,
    wm,
    layoutManager,
    xdndHandler,
    gerenciadorDeJanelas,
    abrirJanela,
    uiGroup,
    passarTempo,
} from './gnome-falso/estado.js';
import {WorkspaceThumbnail} from './gnome-falso/miniatura.js';
import WorkspacesPorMonitor from '../extensao/workspaces-por-monitor@luisgouvea/extension.js';

const JANELAS = [
    {id: 'x1', monitor: 0, global: 0},
    {id: 'x2', monitor: 0, global: 1},
    {id: 'y1', monitor: 1, global: 0},
    {id: 'y2', monitor: 1, global: 1},
];

let extensao = null;

function ligar(cenario = {}) {
    montarCenario({janelas: JANELAS, ...cenario});
    extensao = new WorkspacesPorMonitor();
    extensao.enable();
    desenhar();
    return extensao;
}

afterEach(() => {
    extensao?.disable();
    extensao = null;
});

test('ao ligar, cada monitor continua mostrando o que mostrava e o global vai para o centro', () => {
    ligar();
    assert.equal(indiceAtivo(), 2);
    assert.deepEqual(aVista(0), ['x1']);
    assert.deepEqual(aVista(1), ['y1']);
});

test('atalho troca só o monitor da janela em foco, mesmo com o ponteiro no outro', () => {
    ligar({ponteiro: 1});
    focar('x1');
    const trocas = estado.trocasGlobais;
    apertar('switch-to-workspace-right');
    desenhar();
    assert.deepEqual(aVista(0), ['x2']);
    assert.deepEqual(aVista(1), ['y1']);
    assert.equal(estado.trocasGlobais, trocas);
    assert.equal(estado.foco, janela('x2'));
});

test('na ponta, o atalho não faz nada', () => {
    ligar();
    focar('x1');
    const movimentos = estado.movimentos;
    apertar('switch-to-workspace-left');
    assert.deepEqual(aVista(0), ['x1']);
    assert.equal(estado.movimentos, movimentos);
});

test('atalho numerado vai ao workspace daquele monitor', () => {
    ligar();
    focar('y1');
    apertar('switch-to-workspace-2');
    assert.deepEqual(aVista(1), ['y2']);
    apertar('switch-to-workspace-3');
    assert.deepEqual(aVista(1), []);
    assert.deepEqual(aVista(0), ['x1']);
});

test('Overview e gesto trocam só o monitor do ponteiro', () => {
    ligar({ponteiro: 1});
    estado.workspaces[3].activate(0);
    assert.deepEqual(aVista(1), ['y2']);
    assert.deepEqual(aVista(0), ['x1']);
    estado.workspaces[3].activate(0);
    assert.deepEqual(aVista(1), []);
    const movimentos = estado.movimentos;
    estado.workspaces[3].activate(0);
    assert.equal(estado.movimentos, movimentos);
    assert.deepEqual(aVista(0), ['x1']);
    assert.equal(indiceAtivo(), 2);
});

test('miniatura além da ponta não faz nada', () => {
    ligar({ponteiro: 0});
    estado.workspaces[1].activate(0);
    assert.deepEqual(aVista(0), ['x1']);
    assert.equal(indiceAtivo(), 2);
});

test('Alt+Tab para uma janela do outro monitor troca só aquele monitor', () => {
    ligar({ponteiro: 0});
    focar('x1');
    janela('y2').get_workspace().activate_with_focus(janela('y2'), 0);
    assert.deepEqual(aVista(1), ['y2']);
    assert.deepEqual(aVista(0), ['x1']);
    assert.equal(estado.foco, janela('y2'));
    assert.equal(indiceAtivo(), 2);
});

test('troca global vinda de fora é compensada no monitor da janela que recebeu o foco', () => {
    ligar({ponteiro: 0});
    janela('y2').activate();
    assert.equal(indiceAtivo(), 3);
    desenhar();
    assert.equal(indiceAtivo(), 2);
    assert.deepEqual(aVista(1), ['y2']);
    assert.deepEqual(aVista(0), ['x1']);
    assert.equal(estado.foco, janela('y2'));
});

test('troca global sem janela em foco e além da ponta é desfeita', () => {
    ligar({ponteiro: 1});
    ativarPeloMutter(estado.workspaces[1], null);
    assert.equal(estado.foco, null);
    desenhar();
    assert.equal(indiceAtivo(), 2);
    assert.deepEqual(aVista(0), ['x1']);
    assert.deepEqual(aVista(1), ['y1']);
});

test('troca global para uma janela fora das pontas não entra em laço', () => {
    ligar({ponteiro: 0});
    estado.janelas.find(j => j.id === 'y2').workspace = estado.workspaces[0];
    janela('y2').activate();
    desenhar();
    assert.equal(indiceAtivo(), 2);
    assert.deepEqual(aVista(1), ['y1', 'y2']);
    assert.deepEqual(aVista(0), ['x1']);
    assert.equal(estado.foco, janela('y2'));
});

test('janela solta numa miniatura fora das pontas volta para dentro', () => {
    ligar();
    janela('x2').change_workspace_by_index(0);
    desenhar();
    assert.deepEqual(aVista(0), ['x1', 'x2']);
});

test('levar a janela ao workspace vizinho acompanha a janela', () => {
    ligar();
    focar('x1');
    apertar('move-to-workspace-right');
    assert.deepEqual(aVista(0), ['x1', 'x2']);
    assert.equal(estado.foco, janela('x1'));
    desenhar();
    apertar('switch-to-workspace-left');
    assert.deepEqual(aVista(0), ['x1', 'x2']);
    assert.deepEqual(aVista(1), ['y1']);
});

test('janela levada para o outro monitor aparece no workspace visível dele', () => {
    ligar();
    janela('x1').moverParaMonitor(1);
    desenhar();
    assert.deepEqual(aVista(1), ['x1', 'y1']);
    assert.deepEqual(aVista(0), ['x2']);
});

test('arquivo arrastado sobre as miniaturas não troca workspace', () => {
    ligar({ponteiro: 0});
    xdndHandler.emitir('drag-begin');
    estado.workspaces[3].activate(0);
    assert.deepEqual(aVista(0), ['x1']);
    xdndHandler.emitir('drag-end');
    estado.workspaces[3].activate(0);
    assert.deepEqual(aVista(0), ['x2']);
});

test('janelas em todos os workspaces e diálogos não são movidos', () => {
    ligar({
        janelas: [
            ...JANELAS,
            {id: 'fixa', monitor: 0, global: 0, emTodos: true},
            {id: 'dialogo', monitor: 0, global: 0, tipo: 3},
        ],
    });
    focar('x1');
    apertar('switch-to-workspace-right');
    assert.equal(janela('fixa').get_workspace(), estado.workspaces[0]);
    assert.equal(janela('dialogo').get_workspace(), estado.workspaces[0]);
});

test('monitor novo não mexe nas janelas existentes', () => {
    ligar();
    const movimentos = estado.movimentos;
    estado.monitores = [0, 1, 2];
    layoutManager.emitir('monitors-changed');
    desenhar();
    assert.equal(estado.movimentos, movimentos);
    assert.deepEqual(aVista(0), ['x1']);
    assert.deepEqual(aVista(1), ['y1']);
});

test('configuração inválida avisa e deixa tudo com o GNOME', () => {
    ligar({dinamicos: true});
    assert.equal(estado.notificacoes.length, 1);
    assert.match(estado.notificacoes[0].detalhe, /dinâmicos/);
    focar('x1');
    apertar('switch-to-workspace-right');
    assert.deepEqual(estado.atalhosDoShell, ['switch-to-workspace-right']);
    estado.workspaces[1].activate(0);
    assert.equal(indiceAtivo(), 1);
});

test('desligar devolve os métodos e os atalhos ao GNOME', () => {
    const ativarOriginal = Workspace.prototype.activate;
    const ativarComFocoOriginal = Workspace.prototype.activate_with_focus;
    ligar();
    assert.notEqual(Workspace.prototype.activate, ativarOriginal);
    extensao.disable();
    extensao = null;
    assert.equal(Workspace.prototype.activate, ativarOriginal);
    assert.equal(Workspace.prototype.activate_with_focus, ativarComFocoOriginal);
    wm.atalhos.get('switch-to-workspace-right')(null, null, {get_name: () => 'switch-to-workspace-right'});
    assert.deepEqual(estado.atalhosDoShell, ['switch-to-workspace-right']);
});

function abrirOverview() {
    estado.overviewAberto = true;
}

test('um clique na miniatura troca o monitor dela e fecha o Overview', () => {
    ligar({ponteiro: 1});
    abrirOverview();
    new WorkspaceThumbnail(estado.workspaces[3], 0).activate(0);
    assert.deepEqual(aVista(0), ['x2']);
    assert.deepEqual(aVista(1), ['y1']);
    assert.equal(estado.overviewAberto, false);
    assert.equal(indiceAtivo(), 2);
});

test('clicar numa janela dentro da miniatura vai para ela e a foca, mesmo com outra por cima', () => {
    ligar({ponteiro: 0, janelas: [...JANELAS, {id: 'y3', monitor: 1, global: 1}]});
    abrirOverview();
    focar('x1');
    const miniatura = new WorkspaceThumbnail(estado.workspaces[3], 1);
    miniatura._addWindowClone(janela('y2')).clicar();
    assert.deepEqual(aVista(1), ['y2', 'y3']);
    assert.deepEqual(aVista(0), ['x1']);
    assert.equal(estado.foco, janela('y2'));
    assert.equal(estado.overviewAberto, false);
});

test('clicar na miniatura do workspace atual só fecha o Overview', () => {
    ligar();
    abrirOverview();
    const movimentos = estado.movimentos;
    new WorkspaceThumbnail(estado.workspaces[2], 0).activate(0);
    assert.equal(estado.movimentos, movimentos);
    assert.equal(estado.overviewAberto, false);
});

test('miniatura além da ponta não faz nada e o Overview continua aberto', () => {
    ligar();
    abrirOverview();
    const movimentos = estado.movimentos;
    new WorkspaceThumbnail(estado.workspaces[1], 0).activate(0);
    assert.equal(estado.movimentos, movimentos);
    assert.equal(estado.overviewAberto, true);
});

test('com configuração inválida a miniatura segue o GNOME', () => {
    ligar({dinamicos: true});
    abrirOverview();
    new WorkspaceThumbnail(estado.workspaces[1], 0).activate(0);
    assert.equal(indiceAtivo(), 1);
    assert.equal(estado.overviewAberto, true);
});

test('desligar devolve os métodos originais da miniatura', () => {
    const ativarOriginal = WorkspaceThumbnail.prototype.activate;
    const adicionarCloneOriginal = WorkspaceThumbnail.prototype._addWindowClone;
    ligar();
    assert.notEqual(WorkspaceThumbnail.prototype.activate, ativarOriginal);
    extensao.disable();
    extensao = null;
    assert.equal(WorkspaceThumbnail.prototype.activate, ativarOriginal);
    assert.equal(WorkspaceThumbnail.prototype._addWindowClone, adicionarCloneOriginal);
});

const DIVIDINDO_O_WS1 = [
    {id: 'x1', monitor: 0, global: 0},
    {id: 'x1b', monitor: 0, global: 0},
    {id: 'y1', monitor: 1, global: 0},
];

test('maximizar leva a janela, sozinha, ao workspace vazio à direita só daquele monitor', () => {
    ligar({janelas: DIVIDINDO_O_WS1});
    janela('x1').maximizar();
    desenhar();
    assert.deepEqual(aVista(0), ['x1']);
    assert.deepEqual(aVista(1), ['y1']);
    assert.equal(estado.foco, janela('x1'));
    assert.equal(indiceAtivo(), 2);
});

test('desmaximizar devolve a janela ao workspace de origem, e o monitor vai junto', () => {
    ligar({janelas: DIVIDINDO_O_WS1});
    janela('x1').maximizar();
    desenhar();
    assert.deepEqual(aVista(0), ['x1']);
    janela('x1').desmaximizar();
    desenhar();
    assert.deepEqual(aVista(0), ['x1', 'x1b']);
    assert.deepEqual(aVista(1), ['y1']);
});

test('fechar a janela maximizada devolve o monitor ao workspace de origem', () => {
    ligar({janelas: DIVIDINDO_O_WS1});
    janela('x1').maximizar();
    desenhar();
    assert.deepEqual(aVista(0), ['x1']);
    janela('x1').fechar();
    desenhar();
    assert.deepEqual(aVista(0), ['x1b']);
    assert.deepEqual(aVista(1), ['y1']);
});

test('sem workspace vazio no monitor, maximiza no lugar', () => {
    ligar({
        janelas: [
            ...DIVIDINDO_O_WS1,
            {id: 'x2', monitor: 0, global: 1},
            {id: 'x3', monitor: 0, global: 2},
        ],
    });
    const movimentos = estado.movimentos;
    janela('x1').maximizar();
    desenhar();
    assert.equal(estado.movimentos, movimentos);
    assert.deepEqual(aVista(0), ['x1', 'x1b']);
});

test('meia tela e tela cheia não levam a janela a lugar nenhum', () => {
    ligar({janelas: DIVIDINDO_O_WS1});
    const movimentos = estado.movimentos;
    janela('x1').maximizarSoNaVertical();
    janela('x1b').telaCheia();
    desenhar();
    assert.equal(estado.movimentos, movimentos);
    assert.deepEqual(aVista(0), ['x1', 'x1b']);
});

test('janela que já está sozinha maximiza no lugar', () => {
    ligar({janelas: DIVIDINDO_O_WS1});
    const movimentos = estado.movimentos;
    janela('y1').maximizar();
    desenhar();
    assert.equal(estado.movimentos, movimentos);
    assert.deepEqual(aVista(1), ['y1']);
});

test('janela fora de vista que se maximiza sozinha não arrasta o monitor', () => {
    ligar({janelas: [...DIVIDINDO_O_WS1, {id: 'x2', monitor: 0, global: 1}, {id: 'x2b', monitor: 0, global: 1}]});
    const movimentos = estado.movimentos;
    janela('x2').maximizar();
    desenhar();
    assert.equal(estado.movimentos, movimentos);
    assert.deepEqual(aVista(0), ['x1', 'x1b']);
});

test('desligar solta os sinais de maximizar e fechar', () => {
    ligar({janelas: DIVIDINDO_O_WS1});
    extensao.disable();
    extensao = null;
    assert.equal(gerenciadorDeJanelas._ligacoes.length, 0);
});

const EMPURRANDO = [
    {id: 'x1', monitor: 0, global: 0},
    {id: 'x1b', monitor: 0, global: 0},
    {id: 'x2', monitor: 0, global: 1},
    {id: 'y1', monitor: 1, global: 0},
];

test('maximizar insere o workspace logo à direita e empurra o que estava lá', () => {
    ligar({janelas: EMPURRANDO});
    janela('x1').maximizar();
    desenhar();
    assert.deepEqual(aVista(0), ['x1']);
    assert.deepEqual(aVista(1), ['y1']);
    focar('x1');
    apertar('switch-to-workspace-right');
    assert.deepEqual(aVista(0), ['x2']);
    apertar('switch-to-workspace-1');
    assert.deepEqual(aVista(0), ['x1b']);
});

test('desmaximizar desfaz o empurrão: o workspace some e a ordem volta', () => {
    ligar({janelas: EMPURRANDO});
    janela('x1').maximizar();
    desenhar();
    assert.deepEqual(aVista(0), ['x1']);
    janela('x1').desmaximizar();
    desenhar();
    assert.deepEqual(aVista(0), ['x1', 'x1b']);
    focar('x1');
    apertar('switch-to-workspace-right');
    assert.deepEqual(aVista(0), ['x2']);
});

test('fechar a maximizada também desfaz o empurrão', () => {
    ligar({janelas: EMPURRANDO});
    janela('x1').maximizar();
    desenhar();
    assert.deepEqual(aVista(0), ['x1']);
    janela('x1').fechar();
    desenhar();
    assert.deepEqual(aVista(0), ['x1b']);
    focar('x1b');
    apertar('switch-to-workspace-right');
    assert.deepEqual(aVista(0), ['x2']);
});

test('sem vazio à direita, empurra para a esquerda e a janela continua à vista', () => {
    ligar({
        ativo: 1,
        janelas: [
            {id: 'x2', monitor: 0, global: 1},
            {id: 'x2b', monitor: 0, global: 1},
            {id: 'x3', monitor: 0, global: 2},
            {id: 'y1', monitor: 1, global: 1},
        ],
    });
    assert.deepEqual(aVista(0), ['x2', 'x2b']);
    janela('x2').maximizar();
    desenhar();
    assert.deepEqual(aVista(0), ['x2']);
    assert.deepEqual(aVista(1), ['y1']);
    focar('x2');
    apertar('switch-to-workspace-left');
    assert.deepEqual(aVista(0), ['x2b']);
    apertar('switch-to-workspace-3');
    assert.deepEqual(aVista(0), ['x3']);
});

test('duas maximizações seguidas: fechar a primeira ainda volta ao lugar certo', () => {
    ligar({
        janelas: [
            {id: 'a', monitor: 0, global: 0},
            {id: 'b', monitor: 0, global: 0},
            {id: 'c', monitor: 0, global: 0},
        ],
    });
    janela('a').maximizar();
    desenhar();
    focar('a');
    apertar('switch-to-workspace-left');
    assert.deepEqual(aVista(0), ['b', 'c']);
    janela('b').maximizar();
    desenhar();
    assert.deepEqual(aVista(0), ['b']);
    apertar('switch-to-workspace-right');
    assert.deepEqual(aVista(0), ['a']);
    janela('a').fechar();
    desenhar();
    assert.deepEqual(aVista(0), ['c']);
    focar('c');
    apertar('switch-to-workspace-right');
    assert.deepEqual(aVista(0), ['b']);
});

const TRES_OCUPADOS = [
    {id: 'x1', monitor: 0, global: 0},
    {id: 'x2', monitor: 0, global: 1},
    {id: 'x3', monitor: 0, global: 2},
    {id: 'y1', monitor: 1, global: 1},
];

test('fechar a última janela do workspace do meio: ele some e o da direita entra no lugar', () => {
    ligar({ativo: 1, janelas: TRES_OCUPADOS});
    assert.deepEqual(aVista(0), ['x2']);
    focar('x2');
    janela('x2').fechar();
    desenhar();
    assert.deepEqual(aVista(0), ['x3']);
    assert.deepEqual(aVista(1), ['y1']);
    focar('x3');
    apertar('switch-to-workspace-left');
    assert.deepEqual(aVista(0), ['x1']);
    apertar('switch-to-workspace-right');
    assert.deepEqual(aVista(0), ['x3']);
});

test('fechar a última janela do último workspace leva ao da esquerda', () => {
    ligar({ativo: 1, janelas: TRES_OCUPADOS});
    focar('x2');
    apertar('switch-to-workspace-right');
    assert.deepEqual(aVista(0), ['x3']);
    janela('x3').fechar();
    desenhar();
    assert.deepEqual(aVista(0), ['x2']);
    assert.equal(estado.foco, janela('x2'));
});

test('a navegação para no vazio do fim, por atalho e por miniatura', () => {
    ligar({
        janelas: [
            {id: 'x1', monitor: 0, global: 0},
            {id: 'y1', monitor: 1, global: 0},
        ],
    });
    focar('x1');
    apertar('switch-to-workspace-right');
    assert.deepEqual(aVista(0), []);
    const movimentos = estado.movimentos;
    apertar('switch-to-workspace-right');
    assert.equal(estado.movimentos, movimentos);
    apertar('switch-to-workspace-1');
    assert.deepEqual(aVista(0), ['x1']);
    abrirOverview();
    new WorkspaceThumbnail(estado.workspaces[4], 0).activate(0);
    assert.equal(estado.overviewAberto, true);
    assert.deepEqual(aVista(0), ['x1']);
    assert.deepEqual(aVista(1), ['y1']);
});

test('buraco atrás do workspace à vista some sem mudar o que se vê nem roubar o foco', () => {
    ligar({ativo: 2, janelas: TRES_OCUPADOS});
    assert.deepEqual(aVista(0), ['x3']);
    focar('y1');
    janela('x2').moverParaMonitor(1);
    desenhar();
    assert.deepEqual(aVista(0), ['x3']);
    assert.equal(estado.foco, janela('y1'));
    focar('x3');
    apertar('switch-to-workspace-left');
    assert.deepEqual(aVista(0), ['x1']);
});

test('a janela da área de trabalho (DING) nunca é movida nem focada, mesmo antes de o DING reconhecê-la', () => {
    ligar();
    abrirJanela({id: 'ding', monitor: 0, global: 2, titulo: 'Desktop Icons 1'});
    abrirJanela({id: 'ding-marcada', monitor: 0, global: 2, marcaDoDing: {}});
    desenhar();
    focar('x1');
    apertar('switch-to-workspace-right');
    desenhar();
    assert.equal(janela('ding').get_workspace(), estado.workspaces[2]);
    assert.equal(janela('ding-marcada').get_workspace(), estado.workspaces[2]);
    assert.deepEqual(aVista(0), ['ding', 'ding-marcada', 'x2']);
    apertar('switch-to-workspace-right');
    assert.deepEqual(aVista(0), ['ding', 'ding-marcada']);
    assert.notEqual(estado.foco, janela('ding'));
    assert.notEqual(estado.foco, janela('ding-marcada'));
});

test('a janela do DING não conta como ocupante de workspace', () => {
    ligar({janelas: [{id: 'x1', monitor: 0, global: 0}, {id: 'y1', monitor: 1, global: 0}]});
    abrirJanela({id: 'ding', monitor: 0, global: 2, titulo: 'Desktop Icons 1'});
    desenhar();
    focar('x1');
    apertar('switch-to-workspace-right');
    assert.deepEqual(aVista(0), ['ding']);
    const movimentos = estado.movimentos;
    apertar('switch-to-workspace-right');
    assert.equal(estado.movimentos, movimentos);
});

function avisos() {
    return uiGroup.filhos.map(ator => {
        const pontos = ator.filhos[0].filhos;
        return {
            monitor: ator.restricoes[0].index,
            pontos: pontos.length,
            atual: pontos.findIndex(p => p.pseudoClasses.has('active')) + 1,
        };
    });
}

test('aviso: o atalho mostra os pontos só no monitor que trocou', () => {
    ligar({ponteiro: 1});
    focar('x1');
    apertar('switch-to-workspace-right');
    assert.deepEqual(avisos(), [{monitor: 0, pontos: 3, atual: 2}]);
});

test('aviso: some sozinho e é destruído depois do tempo', () => {
    ligar();
    focar('x1');
    apertar('switch-to-workspace-right');
    const ator = uiGroup.filhos[0];
    passarTempo(599);
    assert.equal(avisos().length, 1);
    passarTempo(1);
    assert.deepEqual(avisos(), []);
    assert.equal(ator.destruido, true);
    assert.equal(estado.temporizadores.size, 0);
});

test('aviso: trocar de novo reaproveita o mesmo aviso e reinicia o tempo', () => {
    ligar();
    focar('x1');
    apertar('switch-to-workspace-right');
    const ator = uiGroup.filhos[0];
    passarTempo(400);
    apertar('switch-to-workspace-left');
    assert.equal(uiGroup.filhos.length, 1);
    assert.equal(uiGroup.filhos[0], ator);
    assert.deepEqual(avisos(), [{monitor: 0, pontos: 3, atual: 1}]);
    passarTempo(599);
    assert.equal(avisos().length, 1);
    passarTempo(1);
    assert.deepEqual(avisos(), []);
});

test('aviso: o gesto mostra no monitor do ponteiro, mas não com o Overview aberto', () => {
    ligar({ponteiro: 1});
    estado.workspaces[3].activate(0);
    assert.deepEqual(avisos(), [{monitor: 1, pontos: 3, atual: 2}]);
    passarTempo(1000);
    abrirOverview();
    estado.workspaces[1].activate(0);
    assert.deepEqual(avisos(), []);
});

test('aviso: clicar numa miniatura fecha o Overview e mostra o aviso', () => {
    ligar({ponteiro: 1});
    abrirOverview();
    new WorkspaceThumbnail(estado.workspaces[3], 0).activate(0);
    assert.equal(estado.overviewAberto, false);
    assert.deepEqual(avisos(), [{monitor: 0, pontos: 3, atual: 2}]);
});

test('aviso: na ponta aparece sem mover nada', () => {
    ligar();
    focar('x1');
    const movimentos = estado.movimentos;
    apertar('switch-to-workspace-left');
    assert.equal(estado.movimentos, movimentos);
    assert.deepEqual(avisos(), [{monitor: 0, pontos: 3, atual: 1}]);
});

test('aviso: levar a janela junto também mostra', () => {
    ligar();
    focar('x1');
    apertar('move-to-workspace-right');
    assert.deepEqual(avisos(), [{monitor: 0, pontos: 3, atual: 2}]);
});

test('aviso: maximizar e a arrumação automática não mostram', () => {
    ligar({janelas: DIVIDINDO_O_WS1});
    janela('x1').maximizar();
    desenhar();
    janela('x1').fechar();
    desenhar();
    assert.deepEqual(avisos(), []);
});

test('aviso: desligar com o aviso à vista não deixa nada na tela', () => {
    ligar();
    focar('x1');
    apertar('switch-to-workspace-right');
    const ator = uiGroup.filhos[0];
    extensao.disable();
    extensao = null;
    assert.deepEqual(uiGroup.filhos, []);
    assert.equal(ator.destruido, true);
    assert.equal(estado.temporizadores.size, 0);
    passarTempo(1000);
});

test('aviso: mudar os monitores apaga os avisos', () => {
    ligar();
    focar('x1');
    apertar('switch-to-workspace-right');
    layoutManager.emitir('monitors-changed');
    desenhar();
    assert.deepEqual(uiGroup.filhos, []);
    assert.equal(estado.temporizadores.size, 0);
});
