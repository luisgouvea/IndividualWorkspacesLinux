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
} from './gnome-falso/estado.js';
import WorkspacesPorMonitor from '../extensao/workspaces-por-monitor@luisgouvea/extension.js';

const JANELAS = [
    {id: 'x1', monitor: 0, global: 0},
    {id: 'x2', monitor: 0, global: 1},
    {id: 'y1', monitor: 1, global: 0},
    {id: 'y2', monitor: 1, global: 2},
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
    apertar('switch-to-workspace-3');
    assert.deepEqual(aVista(1), ['y2']);
    assert.deepEqual(aVista(0), ['x1']);
});

test('Overview e gesto trocam só o monitor do ponteiro', () => {
    ligar({ponteiro: 1});
    estado.workspaces[3].activate(0);
    assert.deepEqual(aVista(1), []);
    assert.deepEqual(aVista(0), ['x1']);
    estado.workspaces[3].activate(0);
    assert.deepEqual(aVista(1), ['y2']);
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
    assert.equal(indiceAtivo(), 4);
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
    apertar('switch-to-workspace-left');
    assert.deepEqual(aVista(0), []);
    assert.deepEqual(aVista(1), ['y1']);
});

test('janela levada para o outro monitor aparece no workspace visível dele', () => {
    ligar();
    janela('x1').moverParaMonitor(1);
    desenhar();
    assert.deepEqual(aVista(1), ['x1', 'y1']);
    assert.deepEqual(aVista(0), []);
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
