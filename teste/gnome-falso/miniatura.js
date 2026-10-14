import {Sinais, overview, estado, DragMotionResult, moveWindowToMonitorAndWorkspace} from './estado.js';

export const ThumbnailState = {NORMAL: 4, REMOVING: 5};

export class WindowClone extends Sinais {
    constructor(metaWindow) {
        super();
        this.metaWindow = metaWindow;
    }

    connect(nome, acao) {
        this.connectObject(nome, acao, this);
    }

    clicar() {
        this.emitir('selected', 0);
    }
}

export class WorkspaceThumbnail {
    constructor(metaWorkspace, monitorIndex) {
        this.metaWorkspace = metaWorkspace;
        this.monitorIndex = monitorIndex;
        this.state = ThumbnailState.NORMAL;
    }

    activate(time) {
        if (this.state > ThumbnailState.NORMAL)
            return;
        if (this.metaWorkspace === global.workspace_manager.get_active_workspace())
            overview.hide();
        else
            this.metaWorkspace.activate(time);
    }

    _addWindowClone(janela) {
        const clone = new WindowClone(janela);
        clone.connect('selected', (_, time) => this.activate(time));
        return clone;
    }
}

const LARGURA = 80;
const ESPACO = 20;
const CORTE = 10;

export class ThumbnailsBox {
    constructor(monitorIndex) {
        this._monitorIndex = monitorIndex;
        this._dropWorkspace = -1;
        this._dropPlaceholderPos = -1;
        this._thumbnails = estado.workspaces.map((metaWorkspace, indice) =>
            ({metaWorkspace, x: indice * (LARGURA + ESPACO), width: LARGURA}));
    }

    get_theme_node() {
        return {get_length: () => ESPACO};
    }

    queue_relayout() {}

    _getPlaceholderTarget(index, spacing) {
        const workspace = this._thumbnails[index];
        let inicio = workspace.x - spacing - CORTE;
        const fim = workspace.x + CORTE;
        if (index === 0)
            inicio += spacing + CORTE;
        if (index === this._dropPlaceholderPos)
            inicio -= LARGURA + spacing;
        return [inicio, fim];
    }

    _withinWorkspace(x, index) {
        const workspace = this._thumbnails[index];
        let fim = workspace.x + workspace.width - CORTE;
        if (index === this._thumbnails.length - 1)
            fim += CORTE;
        return x > workspace.x + CORTE && x <= fim;
    }

    handleDragOver(source, _actor, x) {
        this._dropWorkspace = -1;
        this._dropPlaceholderPos = -1;
        if (!source.metaWindow)
            return DragMotionResult.CONTINUE;
        this._dropWorkspace = this._thumbnails.findIndex((_miniatura, indice) => this._withinWorkspace(x, indice));
        return this._dropWorkspace === -1 ? DragMotionResult.CONTINUE : DragMotionResult.MOVE_DROP;
    }

    acceptDrop(source) {
        if (this._dropWorkspace !== -1) {
            moveWindowToMonitorAndWorkspace(source.metaWindow, this._monitorIndex, this._dropWorkspace);
            return true;
        }
        if (this._dropPlaceholderPos !== -1) {
            estado.insercoesGlobais += 1;
            return true;
        }
        return false;
    }
}
