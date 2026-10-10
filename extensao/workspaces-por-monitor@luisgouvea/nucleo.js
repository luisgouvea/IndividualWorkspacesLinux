export function lerConfiguracao({dinamicos, apenasNoPrincipal, total}) {
    const problemas = [];
    if (dinamicos)
        problemas.push('os workspaces estão dinâmicos: use um número fixo');
    if (apenasNoPrincipal)
        problemas.push('os workspaces estão só no monitor principal: ative "Workspaces em todas as telas"');
    if (total < 3 || total % 2 === 0)
        problemas.push(`há ${total} workspaces: use um número ímpar a partir de 3 (5 dá 3 por monitor)`);

    if (problemas.length > 0)
        return {valida: false, problemas};

    const porMonitor = (total + 1) / 2;
    return {valida: true, problemas, total, porMonitor, centro: porMonitor - 1};
}

function limitar(valor, minimo, maximo) {
    return Math.min(Math.max(valor, minimo), maximo);
}

function virtualLimitado(global, ativo, visivel, config) {
    return limitar(global - ativo + visivel, 1, config.porMonitor);
}

export function visivelQueCabe(globais, ativo, config, preferido = limitar(ativo + 1, 1, config.porMonitor)) {
    if (globais.length === 0)
        return preferido;

    const menor = Math.min(...globais);
    const maior = Math.max(...globais);
    const desde = Math.max(1, 1 - menor + ativo);
    const ate = Math.min(config.porMonitor, config.porMonitor - maior + ativo);

    if (desde > ate)
        return preferido;
    return limitar(preferido, desde, ate);
}

export function planejarInicio(janelas, ativo, config, {monitores = [], preferidos = {}} = {}) {
    const todos = new Set([...monitores, ...janelas.map(j => j.monitor)]);
    const visiveis = {};
    for (const monitor of todos) {
        const globais = janelas.filter(j => j.monitor === monitor).map(j => j.global);
        visiveis[monitor] = visivelQueCabe(globais, ativo, config, preferidos[monitor]);
    }

    const movimentos = [];
    for (const janela of janelas) {
        const visivel = visiveis[janela.monitor];
        const virtual = virtualLimitado(janela.global, ativo, visivel, config);
        const global = virtual - visivel + config.centro;
        if (global !== janela.global)
            movimentos.push({id: janela.id, global});
    }

    return {visiveis, movimentos};
}

export function planejarTroca(janelas, visivel, delta, config) {
    const novoVisivel = visivel + delta;
    if (novoVisivel < 1 || novoVisivel > config.porMonitor)
        return null;

    const movimentos = [];
    for (const janela of janelas) {
        const virtual = virtualLimitado(janela.global, config.centro, visivel, config);
        const global = virtual - novoVisivel + config.centro;
        if (global !== janela.global)
            movimentos.push({id: janela.id, global});
    }

    return {visivel: novoVisivel, movimentos};
}

export function planejarLevarJanela(janelas, id, visivel, delta, config) {
    const levada = janelas.find(j => j.id === id);
    const plano = planejarTroca(janelas.filter(j => j.id !== id), visivel, delta, config);
    if (plano === null || delta === 0)
        return null;

    if (levada && levada.global !== config.centro)
        plano.movimentos.push({id, global: config.centro});
    return plano;
}

export function deslocar(virtual, {de, ate, passo}) {
    return virtual >= de && virtual <= ate ? virtual + passo : virtual;
}

function remapear(janelas, visivel, novoVisivel, novoVirtualDe, config) {
    const movimentos = [];
    for (const janela of janelas) {
        const virtual = virtualLimitado(janela.global, config.centro, visivel, config);
        const global = novoVirtualDe(janela, virtual) - novoVisivel + config.centro;
        if (global !== janela.global)
            movimentos.push({id: janela.id, global});
    }
    return movimentos;
}

function ocupacao(janelas, visivel, config) {
    return new Set(janelas.map(j => virtualLimitado(j.global, config.centro, visivel, config)));
}

function vazioAPartirDe(ocupados, inicio, passo, config) {
    for (let virtual = inicio; virtual >= 1 && virtual <= config.porMonitor; virtual += passo) {
        if (!ocupados.has(virtual))
            return virtual;
    }
    return null;
}

function remocao(virtual, config) {
    return {de: virtual + 1, ate: config.porMonitor, passo: -1};
}

export function planejarMaximizar(janelas, id, visivel, config) {
    const maximizada = janelas.find(j => j.id === id);
    if (!maximizada)
        return null;

    const atual = virtualLimitado(maximizada.global, config.centro, visivel, config);
    const outras = janelas.filter(j => j.id !== id);
    const ocupados = ocupacao(outras, visivel, config);
    if (!ocupados.has(atual))
        return null;

    let origem, destino, deslocamento;
    const vazioADireita = vazioAPartirDe(ocupados, atual + 1, 1, config);
    if (vazioADireita !== null) {
        deslocamento = {de: atual + 1, ate: vazioADireita - 1, passo: 1};
        origem = atual;
        destino = atual + 1;
    } else {
        const vazioAEsquerda = vazioAPartirDe(ocupados, atual - 1, -1, config);
        if (vazioAEsquerda === null)
            return null;
        deslocamento = {de: vazioAEsquerda + 1, ate: atual, passo: -1};
        origem = atual - 1;
        destino = atual;
    }

    const movimentos = remapear(janelas, visivel, destino,
        (janela, virtual) => (janela.id === id ? destino : deslocar(virtual, deslocamento)), config);
    return {visivel: destino, origem, destino, deslocamento, movimentos};
}

export function planejarDesmaximizar(janelas, id, visivel, origem, config) {
    const maximizada = janelas.find(j => j.id === id);
    if (!maximizada)
        return null;

    const atual = virtualLimitado(maximizada.global, config.centro, visivel, config);
    if (atual === origem)
        return null;

    const sozinha = !ocupacao(janelas.filter(j => j.id !== id), visivel, config).has(atual);
    const deslocamento = sozinha ? remocao(atual, config) : null;
    const novaOrigem = deslocamento ? deslocar(origem, deslocamento) : origem;

    const movimentos = remapear(janelas, visivel, novaOrigem, (janela, virtual) => {
        if (janela.id === id)
            return novaOrigem;
        return deslocamento ? deslocar(virtual, deslocamento) : virtual;
    }, config);
    return {visivel: novaOrigem, deslocamento, movimentos};
}

export function planejarFechamento(janelas, visivel, {origem, destino}, config) {
    if (ocupacao(janelas, visivel, config).has(destino))
        return null;

    const deslocamento = remocao(destino, config);
    const novoVisivel = deslocar(visivel === destino ? origem : visivel, deslocamento);
    const movimentos = remapear(janelas, visivel, novoVisivel,
        (_janela, virtual) => deslocar(virtual, deslocamento), config);
    return {visivel: novoVisivel, deslocamento, movimentos};
}

export function deltaParaGlobal(global, config) {
    return global - config.centro;
}

export function deltaParaJanela(global, visivel, config) {
    return virtualLimitado(global, config.centro, visivel, config) - visivel;
}

const PASSO_DO_ATALHO = {left: -1, up: -1, right: 1, down: 1};

export function deltaParaAtalho(alvo, visivel, config) {
    if (alvo in PASSO_DO_ATALHO)
        return PASSO_DO_ATALHO[alvo];
    if (alvo === 'last')
        return config.porMonitor - visivel;
    const numero = Number(alvo);
    if (Number.isInteger(numero) && numero >= 1)
        return numero - visivel;
    return 0;
}

export function monitorDaAcao(origem, {ponteiro, foco}) {
    if (origem === 'ponteiro')
        return ponteiro;
    return foco ?? ponteiro;
}
