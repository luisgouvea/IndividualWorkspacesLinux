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
    estado.ajuste = estado.workspaces.indexOf(workspace);
    estado.trocasGlobais += 1;
    workspaceManager.emitir('active-workspace-changed');
    estado.foco = janela ?? janelaPadrao(workspace);
}

export class JanelaFalsa {
    constructor({id, monitor, global, tipo = NORMAL, emTodos = false, transitoriaDe = null, titulo = '', marcaDoDing = null}) {
        this.id = id;
        this.titulo = titulo;
        if (marcaDoDing)
            this.customJS_ding = marcaDoDing;
        this.monitor = monitor;
        this.workspace = estado.workspaces[global];
        this.tipo = tipo;
        this.emTodos = emTodos;
        this.transitoriaDe = transitoriaDe;
        this.minimized = false;
        this.maximizado = 0;
        this.destruida = false;
    }

    get_maximized() {
        return this.maximizado;
    }

    mudarTamanho(maximizado, mudanca) {
        this.maximizado = maximizado;
        gerenciadorDeJanelas.emitir('size-change', ator(this), mudanca);
    }

    maximizar() {
        this.mudarTamanho(Meta.MaximizeFlags.BOTH, Meta.SizeChange.MAXIMIZE);
    }

    maximizarSoNaVertical() {
        this.mudarTamanho(Meta.MaximizeFlags.VERTICAL, Meta.SizeChange.MAXIMIZE);
    }

    telaCheia() {
        gerenciadorDeJanelas.emitir('size-change', ator(this), Meta.SizeChange.FULLSCREEN);
    }

    desmaximizar() {
        this.mudarTamanho(0, Meta.SizeChange.UNMAXIMIZE);
    }

    fechar() {
        this.destruida = true;
        gerenciadorDeJanelas.emitir('destroy', ator(this));
        this.workspace.emitir('window-removed', this);
    }

    get_id() {
        return this.id;
    }

    get_title() {
        return this.titulo;
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
        const origem = this.workspace;
        this.workspace = destino;
        estado.movimentos += 1;
        origem.emitir('window-removed', this);
        destino.emitir('window-added', this);
    }

    activate() {
        if (this.located_on_workspace(estado.ativo))
            estado.foco = this;
        else
            ativarPeloMutter(this.workspace, this);
    }

    moverParaMonitor(monitor) {
        display.emitir('window-left-monitor', this.monitor, this);
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
const gerenciadorDeJanelas = new Sinais();

function ator(janela) {
    return {get_meta_window: () => janela, is_destroyed: () => janela.destruida};
}
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
    window_manager: gerenciadorDeJanelas,
    get_window_actors: () => estado.janelas.map(ator),
    get_current_time: () => 0,
};

export const Meta = {
    WindowType: {NORMAL, DIALOG: 3},
    LaterType: {BEFORE_REDRAW: 3},
    SizeChange: {MAXIMIZE: 0, UNMAXIMIZE: 1, FULLSCREEN: 2, UNFULLSCREEN: 3},
    MaximizeFlags: {HORIZONTAL: 1, VERTICAL: 2, BOTH: 3},
    Workspace,
    prefs_get_dynamic_workspaces: () => estado.dinamicos,
    prefs_get_workspaces_only_on_primary: () => estado.apenasNoPrincipal,
};

export const Shell = {ActionMode: {NORMAL: 1, OVERVIEW: 2}};
export const GLib = {
    SOURCE_REMOVE: false,
    PRIORITY_DEFAULT: 0,
    timeout_add(_prioridade, intervalo, acao) {
        estado.proximoTemporizador += 1;
        estado.temporizadores.set(estado.proximoTemporizador, {quando: estado.agora + intervalo, intervalo, acao});
        return estado.proximoTemporizador;
    },
    source_remove(id) {
        if (!estado.temporizadores.delete(id))
            throw new Error(`source_remove de um temporizador que não existe: ${id}`);
    },
};

export class AtorFalso {
    constructor(propriedades = {}) {
        Object.assign(this, propriedades);
        this.filhos = [];
        this.pai = null;
        this.destruido = false;
        this.pseudoClasses = new Set();
        this.restricoes = [];
        this.visible = true;
        this.opacity = 255;
    }

    vivo() {
        if (this.destruido)
            throw new Error('ator usado depois de destruído');
    }

    add_child(filho) {
        this.vivo();
        filho.pai = this;
        this.filhos.push(filho);
    }

    destroy_all_children() {
        this.vivo();
        for (const filho of [...this.filhos])
            filho.destroy();
    }

    destroy() {
        this.vivo();
        for (const filho of [...this.filhos])
            filho.destroy();
        if (this.pai)
            this.pai.filhos = this.pai.filhos.filter(f => f !== this);
        this.pai = null;
        this.destruido = true;
    }

    add_constraint(restricao) {
        this.vivo();
        this.restricoes.push(restricao);
    }

    add_style_pseudo_class(nome) {
        this.vivo();
        this.pseudoClasses.add(nome);
    }

    show() {
        this.vivo();
        this.visible = true;
    }

    remove_all_transitions() {
        this.vivo();
    }

    ease({opacity, onComplete}) {
        this.vivo();
        if (opacity !== undefined)
            this.opacity = opacity;
        onComplete?.();
    }
}

export const Clutter = {
    Actor: AtorFalso,
    ActorAlign: {CENTER: 'centro', END: 'fim'},
    AnimationMode: {EASE_OUT_QUAD: 'suave'},
    OffscreenRedirect: {ALWAYS: 'sempre'},
};

export const St = {Widget: AtorFalso, BoxLayout: AtorFalso, Bin: AtorFalso};

export const uiGroup = new AtorFalso();

export function passarTempo(milissegundos) {
    estado.agora += milissegundos;
    for (;;) {
        const vencido = [...estado.temporizadores.entries()].find(([, t]) => t.quando <= estado.agora);
        if (!vencido)
            return;
        const [id, temporizador] = vencido;
        estado.temporizadores.delete(id);
        if (temporizador.acao())
            estado.temporizadores.set(id, {...temporizador, quando: estado.agora + temporizador.intervalo});
    }
}
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

export const overview = {
    get visible() {
        return estado.overviewAberto;
    },
    hide() {
        estado.overviewAberto = false;
    },
};
export const xdndHandler = new Sinais();

export function createWorkspacesAdjustment(_ator) {
    return {
        get value() {
            return estado.ajuste;
        },
        set value(valor) {
            estado.ajuste = valor;
        },
    };
}

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
    for (const objeto of [workspaceManager, display, layoutManager, xdndHandler, gerenciadorDeJanelas])
        objeto._ligacoes = [];
    wm.atalhos.clear();
    uiGroup.filhos = [];

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
        overviewAberto: false,
        temporizadores: new Map(),
        proximoTemporizador: 0,
        agora: 0,
        notificacoes: [],
        workspaces: Array.from({length: total}, () => new Workspace()),
    });
    estado.ativo = estado.workspaces[ativo];
    estado.ajuste = ativo;
    estado.janelas = janelas.map(j => new JanelaFalsa(j));
    return estado;
}

const QUADROS_ATE_DESISTIR = 100;

export function desenhar() {
    for (let quadro = 0; estado.laters.size > 0; quadro++) {
        if (quadro === QUADROS_ATE_DESISTIR)
            throw new Error('laters não param de se reagendar');
        const [id, acao] = estado.laters.entries().next().value;
        estado.laters.delete(id);
        acao();
    }
}

export function abrirJanela(especificacao) {
    const nova = new JanelaFalsa(especificacao);
    estado.janelas.push(nova);
    nova.workspace.emitir('window-added', nova);
    return nova;
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
        .filter(j => !j.destruida && j.monitor === monitor && j.located_on_workspace(estado.ativo))
        .map(j => j.id)
        .sort();
}

export function indiceAtivo() {
    return estado.workspaces.indexOf(estado.ativo);
}

export function deslizarNoTouchpad(indice) {
    estado.ajuste = indice;
    const destino = estado.workspaces[indice];
    if (destino !== estado.ativo)
        destino.activate(0);
}

export function deslizarNoOverview(indice) {
    deslizarNoTouchpad(indice);
    estado.ajuste = indiceAtivo();
}

export {Sinais, Workspace, ativarPeloMutter, workspaceManager, gerenciadorDeJanelas};
