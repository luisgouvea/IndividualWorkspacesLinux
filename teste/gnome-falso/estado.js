export const estado = {};

class Sinais {
    constructor() {
        this._ligacoes = [];
    }

    connectObject(...args) {
        const dono = args.at(-1);
        for (let i = 0; i < args.length - 1; i += 2)
            this._ligacoes.push({nome: args[i], acao: args[i + 1], dono});
    }

    disconnectObject(dono) {
        this._ligacoes = this._ligacoes.filter(l => l.dono !== dono);
    }

    emitir(nome, ...args) {
        for (const ligacao of [...this._ligacoes]) {
            if (ligacao.nome === nome)
                ligacao.acao(this, ...args);
        }
    }
}

const NORMAL = 0;

class Workspace extends Sinais {
    index() {
        return estado.workspaces.indexOf(this);
    }

    activate() {
        ativarPeloMutter(this, null);
    }

    activate_with_focus(janela) {
        ativarPeloMutter(this, janela);
    }
}

function janelaPadrao(workspace) {
    return estado.janelas.find(j => j.located_on_workspace(workspace) && !j.minimized) ?? null;
}

function ativarPeloMutter(workspace, janela) {
    if (estado.ativo === workspace) {
        if (janela)
            estado.foco = janela;
        return;
    }
    estado.ativo = workspace;
    estado.trocasGlobais += 1;
    workspaceManager.emitir('active-workspace-changed');
    estado.foco = janela ?? janelaPadrao(workspace);
}

export class JanelaFalsa {
    constructor({id, monitor, global, tipo = NORMAL, emTodos = false, transitoriaDe = null}) {
        this.id = id;
        this.monitor = monitor;
        this.workspace = estado.workspaces[global];
        this.tipo = tipo;
        this.emTodos = emTodos;
        this.transitoriaDe = transitoriaDe;
        this.minimized = false;
    }

    get_id() {
        return this.id;
    }

    get_monitor() {
        return this.monitor;
    }

    get_workspace() {
        return this.workspace;
    }

    get_window_type() {
        return this.tipo;
    }

    is_on_all_workspaces() {
        return this.emTodos;
    }

    get_transient_for() {
        return this.transitoriaDe;
    }

    located_on_workspace(workspace) {
        return this.emTodos || this.workspace === workspace;
    }

    change_workspace_by_index(indice) {
        const destino = estado.workspaces[indice];
        if (destino === this.workspace)
            return;
        this.workspace = destino;
        estado.movimentos += 1;
        destino.emitir('window-added', this);
    }

    activate() {
        if (this.located_on_workspace(estado.ativo))
            estado.foco = this;
        else
            ativarPeloMutter(this.workspace, this);
    }

    moverParaMonitor(monitor) {
        this.monitor = monitor;
        display.emitir('window-entered-monitor', monitor, this);
    }
}

class GerenciadorDeWorkspaces extends Sinais {
    get_n_workspaces() {
        return estado.workspaces.length;
    }

    get_workspace_by_index(indice) {
        return estado.workspaces[indice] ?? null;
    }

    get_active_workspace_index() {
        return estado.workspaces.indexOf(estado.ativo);
    }

    get_active_workspace() {
        return estado.ativo;
    }
}

class Tela extends Sinais {
    get focus_window() {
        return estado.foco;
    }

    get_current_monitor() {
        return estado.ponteiro;
    }

    sort_windows_by_stacking(lista) {
        return [...lista].sort((a, b) => estado.janelas.indexOf(a) - estado.janelas.indexOf(b));
    }
}

class GerenciadorDeLayout extends Sinais {
    get monitors() {
        return estado.monitores.map(index => ({index}));
    }
}

const workspaceManager = new GerenciadorDeWorkspaces();
const display = new Tela();

const laters = {
    add(_tipo, acao) {
        estado.proximoLater += 1;
        estado.laters.set(estado.proximoLater, acao);
        return estado.proximoLater;
    },
    remove(id) {
        estado.laters.delete(id);
    },
};

globalThis.global = {
    workspace_manager: workspaceManager,
    display,
    compositor: {get_laters: () => laters},
    get_window_actors: () => estado.janelas.map(j => ({get_meta_window: () => j})),
    get_current_time: () => 0,
};

export const Meta = {
    WindowType: {NORMAL, DIALOG: 3},
    LaterType: {BEFORE_REDRAW: 3},
    Workspace,
    prefs_get_dynamic_workspaces: () => estado.dinamicos,
    prefs_get_workspaces_only_on_primary: () => estado.apenasNoPrincipal,
};

export const Shell = {ActionMode: {NORMAL: 1, OVERVIEW: 2}};
export const GLib = {SOURCE_REMOVE: false};
export const Gio = {Settings: class extends Sinais {}};

export const wm = {
    atalhos: new Map(),
    setCustomKeybindingHandler(nome, _modos, acao) {
        this.atalhos.set(nome, acao);
    },
    _showWorkspaceSwitcher(...args) {
        estado.atalhosDoShell.push(args.at(-1).get_name());
    },
};

export const layoutManager = new GerenciadorDeLayout();
export const xdndHandler = new Sinais();

export function notify(titulo, detalhe) {
    estado.notificacoes.push({titulo, detalhe});
}

export class Extension {}

export class InjectionManager {
    #salvos = [];

    overrideMethod(prototipo, nome, criar) {
        const original = prototipo[nome];
        this.#salvos.push([prototipo, nome, original]);
        prototipo[nome] = criar(original);
    }

    clear() {
        for (const [prototipo, nome, original] of this.#salvos.reverse())
            prototipo[nome] = original;
        this.#salvos = [];
    }
}

export function montarCenario({
    total = 5,
    ativo = 0,
    monitores = [0, 1],
    dinamicos = false,
    apenasNoPrincipal = false,
    ponteiro = 0,
    janelas = [],
} = {}) {
    for (const objeto of [workspaceManager, display, layoutManager, xdndHandler])
        objeto._ligacoes = [];
    wm.atalhos.clear();

    Object.assign(estado, {
        dinamicos,
        apenasNoPrincipal,
        monitores,
        ponteiro,
        foco: null,
        trocasGlobais: 0,
        movimentos: 0,
        laters: new Map(),
        proximoLater: 0,
        atalhosDoShell: [],
        notificacoes: [],
        workspaces: Array.from({length: total}, () => new Workspace()),
    });
    estado.ativo = estado.workspaces[ativo];
    estado.janelas = janelas.map(j => new JanelaFalsa(j));
    return estado;
}

export function desenhar() {
    while (estado.laters.size > 0) {
        const [id, acao] = estado.laters.entries().next().value;
        estado.laters.delete(id);
        acao();
    }
}

export function janela(id) {
    return estado.janelas.find(j => j.id === id);
}

export function focar(id) {
    estado.foco = janela(id);
}

export function apertar(nome) {
    wm.atalhos.get(nome)(display, estado.foco, {get_name: () => nome});
}

export function aVista(monitor) {
    return estado.janelas
        .filter(j => j.monitor === monitor && j.located_on_workspace(estado.ativo))
        .map(j => j.id)
        .sort();
}

export function indiceAtivo() {
    return estado.workspaces.indexOf(estado.ativo);
}

export {Workspace, ativarPeloMutter, workspaceManager};
