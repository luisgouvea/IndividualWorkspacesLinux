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

export function ordenarMovimentos(movimentos, janelas) {
    const origem = new Map(janelas.map(j => [j.id, j.global]));
    const pendentes = [...movimentos];
    const ordenados = [];
    while (pendentes.length > 0) {
        const livre = pendentes.findIndex(m => !pendentes.some(outro => origem.get(outro.id) === m.global));
        ordenados.push(...pendentes.splice(Math.max(livre, 0), 1));
    }
    return ordenados;
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

export function virtuaisOcupados(janelas, visivel, config) {
    return new Set(janelas.map(j => virtualLimitado(j.global, config.centro, visivel, config)));
}

function vazioAPartirDe(ocupados, inicio, config) {
    for (let virtual = inicio; virtual <= config.porMonitor; virtual++) {
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
    const ocupados = virtuaisOcupados(outras, visivel, config);
    if (!ocupados.has(atual))
        return null;

    const vazioADireita = vazioAPartirDe(ocupados, atual + 1, config);
    if (vazioADireita === null)
        return null;

    const deslocamento = {de: atual + 1, ate: vazioADireita - 1, passo: 1};
    const origem = atual;
    const destino = atual + 1;

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

    const sozinha = !virtuaisOcupados(janelas.filter(j => j.id !== id), visivel, config).has(atual);
    const deslocamento = sozinha ? remocao(atual, config) : null;
    const novaOrigem = deslocamento ? deslocar(origem, deslocamento) : origem;

    const movimentos = remapear(janelas, visivel, novaOrigem, (janela, virtual) => {
        if (janela.id === id)
            return novaOrigem;
        return deslocamento ? deslocar(virtual, deslocamento) : virtual;
    }, config);
    return {visivel: novaOrigem, deslocamento, movimentos};
}

export function planejarInsercao(outras, global, visivel, config) {
    const posicao = global - config.centro + visivel;
    if (posicao < 1 || posicao > ultimoNavegavel(outras, visivel, config))
        return null;

    const vazio = vazioAPartirDe(virtuaisOcupados(outras, visivel, config), posicao, config);
    if (vazio === null)
        return null;

    const deslocamento = {de: posicao, ate: vazio - 1, passo: 1};
    const novoVisivel = deslocar(visivel, deslocamento);
    const movimentos = remapear(outras, visivel, novoVisivel,
        (_janela, virtual) => deslocar(virtual, deslocamento), config);
    return {visivel: novoVisivel, deslocamento, movimentos, global: posicao - novoVisivel + config.centro};
}

export function posicaoAposArrumacao(virtual, ocupados) {
    return Math.max(1, ocupados.filter(o => o <= virtual).length);
}

function visivelAposArrumacao(visivel, ocupados, ocupadosAntes, lembradas, config) {
    if (ocupados.length === 0)
        return 1;
    if (ocupados.includes(visivel))
        return posicaoAposArrumacao(visivel, ocupados);

    const fechada = lembradas.find(l => l.destino === visivel && ocupados.includes(l.origem));
    if (fechada)
        return posicaoAposArrumacao(fechada.origem, ocupados);

    if (ocupadosAntes.has(visivel)) {
        const aDireita = ocupados.find(o => o > visivel);
        return posicaoAposArrumacao(aDireita ?? visivel, ocupados);
    }

    return Math.min(ocupados.length + 1, config.porMonitor);
}

export function planejarArrumacao(janelas, visivel, config, {ocupadosAntes = new Set(), lembradas = []} = {}) {
    const ocupados = [...virtuaisOcupados(janelas, visivel, config)].sort((a, b) => a - b);
    const novoVisivel = visivelAposArrumacao(visivel, ocupados, ocupadosAntes, lembradas, config);
    const movimentos = remapear(janelas, visivel, novoVisivel,
        (_janela, virtual) => posicaoAposArrumacao(virtual, ocupados), config);

    if (movimentos.length === 0 && novoVisivel === visivel)
        return null;
    return {visivel: novoVisivel, ocupados, movimentos};
}

export function ultimoNavegavel(janelas, visivel, config) {
    const ocupados = virtuaisOcupados(janelas, visivel, config);
    const maior = ocupados.size > 0 ? Math.max(...ocupados) : 0;
    return Math.min(config.porMonitor, maior + 1);
}

export function planejarNavegacao(janelas, visivel, delta, config) {
    if (visivel + delta > ultimoNavegavel(janelas, visivel, config))
        return null;
    return planejarTroca(janelas, visivel, delta, config);
}

export function planejarAviso(janelas, visivel, config) {
    return {quantidade: Math.max(ultimoNavegavel(janelas, visivel, config), visivel), atual: visivel};
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
