import {test} from 'node:test';
import assert from 'node:assert/strict';

import {
    lerConfiguracao,
    visivelQueCabe,
    planejarInicio,
    planejarTroca,
    planejarLevarJanela,
    planejarMaximizar,
    planejarVoltaAoFechar,
    deltaParaGlobal,
    deltaParaJanela,
    deltaParaAtalho,
    monitorDaAcao,
} from './extensao/workspaces-por-monitor@luisgouvea/nucleo.js';

const CINCO = lerConfiguracao({dinamicos: false, apenasNoPrincipal: false, total: 5});

function aplicar(janelas, movimentos) {
    const destino = new Map(movimentos.map(m => [m.id, m.global]));
    return janelas.map(j => (destino.has(j.id) ? {...j, global: destino.get(j.id)} : j));
}

function visiveis(janelas, monitor, config) {
    return janelas
        .filter(j => j.monitor === monitor && j.global === config.centro)
        .map(j => j.id)
        .sort();
}

test('cinco workspaces fixos abrangendo as telas dão três por monitor, centro no índice 2', () => {
    assert.deepEqual(CINCO, {valida: true, problemas: [], total: 5, porMonitor: 3, centro: 2});
});

test('configuração inválida lista cada problema e não calcula nada', () => {
    const config = lerConfiguracao({dinamicos: true, apenasNoPrincipal: true, total: 4});
    assert.equal(config.valida, false);
    assert.deepEqual(config.problemas, [
        'os workspaces estão dinâmicos: use um número fixo',
        'os workspaces estão só no monitor principal: ative "Workspaces em todas as telas"',
        'há 4 workspaces: use um número ímpar a partir de 3 (5 dá 3 por monitor)',
    ]);
    assert.equal(config.centro, undefined);
});

test('menos de três workspaces é recusado', () => {
    const config = lerConfiguracao({dinamicos: false, apenasNoPrincipal: false, total: 1});
    assert.equal(config.valida, false);
});

test('trocar para a direita move só as janelas do monitor e avança o visível', () => {
    const janelas = [
        {id: 'a', global: 2},
        {id: 'b', global: 3},
        {id: 'c', global: 4},
    ];
    const plano = planejarTroca(janelas, 1, 1, CINCO);
    assert.deepEqual(plano, {
        visivel: 2,
        movimentos: [
            {id: 'a', global: 1},
            {id: 'b', global: 2},
            {id: 'c', global: 3},
        ],
    });
});

test('trocar para a esquerda volta o visível e as janelas', () => {
    const janelas = [
        {id: 'a', global: 1},
        {id: 'b', global: 2},
    ];
    assert.deepEqual(planejarTroca(janelas, 2, -1, CINCO), {
        visivel: 1,
        movimentos: [
            {id: 'a', global: 2},
            {id: 'b', global: 3},
        ],
    });
});

test('para no último workspace, como no macOS', () => {
    assert.equal(planejarTroca([{id: 'a', global: 2}], 3, 1, CINCO), null);
});

test('para no primeiro workspace, como no macOS', () => {
    assert.equal(planejarTroca([{id: 'a', global: 2}], 1, -1, CINCO), null);
});

test('saltar dois workspaces de uma vez', () => {
    const plano = planejarTroca([{id: 'a', global: 4}], 1, 2, CINCO);
    assert.deepEqual(plano, {visivel: 3, movimentos: [{id: 'a', global: 2}]});
});

test('troca de zero só puxa para dentro a janela que caiu fora das pontas', () => {
    const janelas = [
        {id: 'dentro', global: 3},
        {id: 'antes-do-1', global: 0},
        {id: 'depois-do-3', global: 4},
    ];
    assert.deepEqual(planejarTroca(janelas, 2, 0, CINCO), {
        visivel: 2,
        movimentos: [
            {id: 'antes-do-1', global: 1},
            {id: 'depois-do-3', global: 3},
        ],
    });
});

test('troca sem janelas só muda o visível', () => {
    assert.deepEqual(planejarTroca([], 1, 1, CINCO), {visivel: 2, movimentos: []});
});

test('o visível que cabe mantém as janelas paradas quando possível', () => {
    assert.equal(visivelQueCabe([1, 2, 3], 2, CINCO), 2);
    assert.equal(visivelQueCabe([2, 3, 4], 2, CINCO), 1);
    assert.equal(visivelQueCabe([0, 1, 2], 2, CINCO), 3);
});

test('entre vários visíveis que cabem, fica o preferido', () => {
    assert.equal(visivelQueCabe([2], 2, CINCO, 3), 3);
    assert.equal(visivelQueCabe([2], 2, CINCO, 1), 1);
});

test('sem preferido, o visível é o workspace natural do ativo', () => {
    assert.equal(visivelQueCabe([], 0, CINCO), 1);
    assert.equal(visivelQueCabe([], 1, CINCO), 2);
    assert.equal(visivelQueCabe([], 4, CINCO), 3);
});

test('preferido que não cabe dá lugar ao mais próximo que cabe', () => {
    assert.equal(visivelQueCabe([2, 3], 2, CINCO, 3), 2);
});

test('janelas espalhadas demais ficam no natural e algumas serão puxadas', () => {
    assert.equal(visivelQueCabe([0, 4], 0, CINCO), 1);
});

test('início a partir do GNOME comum mantém o que cada monitor mostra e centraliza', () => {
    const janelas = [
        {id: 'x1', monitor: 0, global: 0},
        {id: 'x2', monitor: 0, global: 1},
        {id: 'x3', monitor: 0, global: 2},
        {id: 'y2', monitor: 1, global: 1},
    ];
    const plano = planejarInicio(janelas, 1, CINCO);
    assert.deepEqual(plano.visiveis, {0: 2, 1: 2});
    const depois = aplicar(janelas, plano.movimentos);
    assert.deepEqual(visiveis(depois, 0, CINCO), ['x2']);
    assert.deepEqual(visiveis(depois, 1, CINCO), ['y2']);
    assert.deepEqual(depois.find(j => j.id === 'x1').global, 1);
    assert.deepEqual(depois.find(j => j.id === 'x3').global, 3);
});

test('início com workspaces além do terceiro junta o excedente no último', () => {
    const janelas = [
        {id: 'a', monitor: 0, global: 0},
        {id: 'd', monitor: 0, global: 3},
        {id: 'e', monitor: 0, global: 4},
    ];
    const plano = planejarInicio(janelas, 0, CINCO);
    assert.deepEqual(plano.visiveis, {0: 1});
    const depois = aplicar(janelas, plano.movimentos);
    assert.deepEqual(depois.map(j => j.global), [2, 4, 4]);
});

test('início respeita o visível que cada monitor já tinha', () => {
    const janelas = [{id: 'a', monitor: 0, global: 2}];
    const plano = planejarInicio(janelas, 2, CINCO, {monitores: [0, 1], preferidos: {0: 3, 1: 2}});
    assert.deepEqual(plano.visiveis, {0: 3, 1: 2});
    assert.deepEqual(plano.movimentos, []);
});

test('início inclui monitores sem janelas', () => {
    const plano = planejarInicio([], 0, CINCO, {monitores: [0, 1]});
    assert.deepEqual(plano.visiveis, {0: 1, 1: 1});
});

test('o delta de um workspace global é a distância até o centro', () => {
    assert.equal(deltaParaGlobal(3, CINCO), 1);
    assert.equal(deltaParaGlobal(0, CINCO), -2);
    assert.equal(deltaParaGlobal(2, CINCO), 0);
});

test('o delta até uma janela leva o workspace dela ao centro', () => {
    assert.equal(deltaParaJanela(4, 1, CINCO), 2);
    assert.equal(deltaParaJanela(1, 3, CINCO), -1);
});

test('janela fora das pontas conta como o workspace mais próximo', () => {
    assert.equal(deltaParaJanela(0, 1, CINCO), 0);
    assert.equal(deltaParaJanela(4, 3, CINCO), 0);
});

test('atalhos de direção andam um workspace', () => {
    assert.equal(deltaParaAtalho('left', 2, CINCO), -1);
    assert.equal(deltaParaAtalho('up', 2, CINCO), -1);
    assert.equal(deltaParaAtalho('right', 2, CINCO), 1);
    assert.equal(deltaParaAtalho('down', 2, CINCO), 1);
});

test('atalho numerado vai ao workspace do monitor, e "last" ao último', () => {
    assert.equal(deltaParaAtalho('1', 3, CINCO), -2);
    assert.equal(deltaParaAtalho('3', 1, CINCO), 2);
    assert.equal(deltaParaAtalho('last', 1, CINCO), 2);
});

test('atalho desconhecido não anda', () => {
    assert.equal(deltaParaAtalho('qualquer', 2, CINCO), 0);
});

test('teclado age no monitor da janela em foco', () => {
    assert.equal(monitorDaAcao('teclado', {ponteiro: 1, foco: 0}), 0);
});

test('teclado sem janela em foco age no monitor do ponteiro', () => {
    assert.equal(monitorDaAcao('teclado', {ponteiro: 1, foco: null}), 1);
});

test('mouse, gesto e Overview agem no monitor do ponteiro', () => {
    assert.equal(monitorDaAcao('ponteiro', {ponteiro: 1, foco: 0}), 1);
});

test('troca global vinda de fora age no monitor da janela que recebeu o foco', () => {
    assert.equal(monitorDaAcao('escape', {ponteiro: 1, foco: 0}), 0);
    assert.equal(monitorDaAcao('escape', {ponteiro: 1, foco: null}), 1);
});

test('trocar no monitor X nunca muda o que o monitor Y mostra', () => {
    let janelas = [
        {id: 'x1', monitor: 0, global: 2},
        {id: 'x2', monitor: 0, global: 3},
        {id: 'y1', monitor: 1, global: 2},
        {id: 'y2', monitor: 1, global: 3},
    ];
    const plano = planejarTroca(janelas.filter(j => j.monitor === 0), 1, 1, CINCO);
    janelas = aplicar(janelas, plano.movimentos);
    assert.deepEqual(visiveis(janelas, 0, CINCO), ['x2']);
    assert.deepEqual(visiveis(janelas, 1, CINCO), ['y1']);
});

test('compensar uma troca global leva só o monitor-alvo e preserva o outro', () => {
    let janelas = [
        {id: 'x1', monitor: 0, global: 2},
        {id: 'y1', monitor: 1, global: 2},
        {id: 'y2', monitor: 1, global: 3},
    ];
    const ativoDepoisDaTroca = 3;
    const plano = planejarTroca(
        janelas.filter(j => j.monitor === 1), 1, deltaParaGlobal(ativoDepoisDaTroca, CINCO), CINCO);
    janelas = aplicar(janelas, plano.movimentos);
    assert.deepEqual(visiveis(janelas, 0, CINCO), ['x1']);
    assert.deepEqual(visiveis(janelas, 1, CINCO), ['y2']);
});

test('levar a janela ao workspace vizinho troca o monitor e deixa a janela à vista', () => {
    const janelas = [
        {id: 'levada', global: 2},
        {id: 'ficou', global: 2},
        {id: 'vizinha', global: 3},
    ];
    assert.deepEqual(planejarLevarJanela(janelas, 'levada', 1, 1, CINCO), {
        visivel: 2,
        movimentos: [
            {id: 'ficou', global: 1},
            {id: 'vizinha', global: 2},
        ],
    });
});

test('levar a janela além da ponta é recusado', () => {
    assert.equal(planejarLevarJanela([{id: 'a', global: 2}], 'a', 3, 1, CINCO), null);
});

test('levar a janela que não estava à vista também a traz para o centro', () => {
    const janelas = [{id: 'a', global: 3}];
    assert.deepEqual(planejarLevarJanela(janelas, 'a', 1, 2, CINCO), {
        visivel: 3,
        movimentos: [{id: 'a', global: 2}],
    });
});

test('maximizar leva a janela ao primeiro workspace vazio à direita, sozinha', () => {
    const janelas = [
        {id: 'max', global: 2},
        {id: 'outra', global: 2},
    ];
    assert.deepEqual(planejarMaximizar(janelas, 'max', 1, CINCO), {
        visivel: 2,
        origem: 1,
        movimentos: [{id: 'outra', global: 1}],
    });
});

test('maximizar pula o workspace ocupado à direita', () => {
    const janelas = [
        {id: 'max', global: 2},
        {id: 'outra', global: 2},
        {id: 'no-ws2', global: 3},
    ];
    const plano = planejarMaximizar(janelas, 'max', 1, CINCO);
    assert.equal(plano.visivel, 3);
    assert.equal(plano.origem, 1);
});

test('sem vaga à direita, maximizar usa o vazio mais próximo à esquerda', () => {
    const janelas = [
        {id: 'max', global: 2},
        {id: 'outra', global: 2},
        {id: 'no-ws1', global: 0},
    ];
    const plano = planejarMaximizar(janelas, 'max', 3, CINCO);
    assert.equal(plano.visivel, 2);
    assert.equal(plano.origem, 3);
});

test('sem nenhuma vaga, maximizar não move nada', () => {
    const janelas = [
        {id: 'max', global: 2},
        {id: 'outra', global: 2},
        {id: 'no-ws2', global: 3},
        {id: 'no-ws3', global: 4},
    ];
    assert.equal(planejarMaximizar(janelas, 'max', 1, CINCO), null);
});

test('janela que já está sozinha não sai do lugar ao maximizar', () => {
    const janelas = [
        {id: 'max', global: 2},
        {id: 'no-ws2', global: 3},
    ];
    assert.equal(planejarMaximizar(janelas, 'max', 1, CINCO), null);
});

test('ao fechar a janela maximizada, o monitor volta à origem se o destino ficou vazio', () => {
    const janelas = [{id: 'outra', global: 1}];
    assert.deepEqual(planejarVoltaAoFechar(janelas, 2, 2, 1, CINCO), {
        visivel: 1,
        movimentos: [{id: 'outra', global: 2}],
    });
});

test('ao fechar, não volta se o destino ainda tem janelas', () => {
    const janelas = [{id: 'chegou-depois', global: 2}];
    assert.equal(planejarVoltaAoFechar(janelas, 2, 2, 1, CINCO), null);
});

test('ao fechar, não volta se o monitor já está em outro workspace', () => {
    assert.equal(planejarVoltaAoFechar([], 3, 2, 1, CINCO), null);
});
