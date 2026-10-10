import {Sinais, overview} from './estado.js';

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
