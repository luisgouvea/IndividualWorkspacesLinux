import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension, InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';

import {
    lerConfiguracao,
    planejarInicio,
    planejarTroca,
    planejarLevarJanela,
    deltaParaGlobal,
    deltaParaJanela,
    deltaParaAtalho,
    monitorDaAcao,
} from './nucleo.js';

const PREFIXO = '[workspaces-por-monitor]';
const MODOS_DOS_ATALHOS = Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW;
const ALVOS_DOS_ATALHOS = ['left', 'right', 'up', 'down', 'last',
    ...Array.from({length: 12}, (_, i) => String(i + 1))];
const ATALHOS = ALVOS_DOS_ATALHOS.flatMap(alvo =>
    [`switch-to-workspace-${alvo}`, `move-to-workspace-${alvo}`]);

export default class WorkspacesPorMonitor extends Extension {
    enable() {
        this._config = null;
        this._visiveis = {};
        this._passarDireto = false;
        this._arrastandoArquivo = false;
        this._avisado = false;
        this._agendados = new Map();
        this._workspacesObservados = [];

        this._injecoes = new InjectionManager();
        this._injetar();
        this._assumirAtalhos();
        this._conectar();
        this._reavaliar();
    }

    disable() {
        this._injecoes.clear();
        this._injecoes = null;
        this._devolverAtalhos();
        this._desconectar();
        this._cancelarAgendados();
        this._config = null;
        this._visiveis = null;
    }

    _injetar() {
        const extensao = this;

        this._injecoes.overrideMethod(Meta.Workspace.prototype, 'activate', original =>
            function (momento) {
                if (!extensao._deveInterceptar())
                    return original.call(this, momento);
                return extensao._aoPedirWorkspace(this.index());
            });

        this._injecoes.overrideMethod(Meta.Workspace.prototype, 'activate_with_focus', original =>
            function (janela, momento) {
                if (!extensao._deveInterceptar() || !janela)
                    return original.call(this, janela, momento);
                return extensao._aoPedirJanela(this.index(), janela, momento);
            });
    }

    _assumirAtalhos() {
        for (const nome of ATALHOS) {
            Main.wm.setCustomKeybindingHandler(nome, MODOS_DOS_ATALHOS,
                (...args) => this._aoAtalho(args));
        }
    }

    _devolverAtalhos() {
        const doShell = Main.wm._showWorkspaceSwitcher.bind(Main.wm);
        for (const nome of ATALHOS)
            Main.wm.setCustomKeybindingHandler(nome, MODOS_DOS_ATALHOS, doShell);
    }

    _conectar() {
        this._mutter = new Gio.Settings({schema_id: 'org.gnome.mutter'});
        this._mutter.connectObject(
            'changed::dynamic-workspaces', () => this._agendar('reavaliar', () => this._reavaliar()),
            'changed::workspaces-only-on-primary', () => this._agendar('reavaliar', () => this._reavaliar()),
            this);
        global.workspace_manager.connectObject(
            'notify::n-workspaces', () => this._agendar('reavaliar', () => this._reavaliar()),
            'active-workspace-changed', () => this._aoTrocarGlobal(),
            this);
        global.display.connectObject(
            'window-entered-monitor', () => this._agendar('normalizar', () => this._normalizar()),
            this);
        Main.layoutManager.connectObject(
            'monitors-changed', () => this._agendar('reiniciar', () => this._iniciar()),
            this);
        Main.xdndHandler.connectObject(
            'drag-begin', () => (this._arrastandoArquivo = true),
            'drag-end', () => (this._arrastandoArquivo = false),
            this);
    }

    _desconectar() {
        this._mutter?.disconnectObject(this);
        this._mutter = null;
        global.workspace_manager.disconnectObject(this);
        global.display.disconnectObject(this);
        Main.layoutManager.disconnectObject(this);
        Main.xdndHandler.disconnectObject(this);
        this._soltarWorkspaces();
    }

    _observarWorkspaces() {
        this._soltarWorkspaces();
        const gerenciador = global.workspace_manager;
        for (let i = 0; i < gerenciador.get_n_workspaces(); i++) {
            const workspace = gerenciador.get_workspace_by_index(i);
            workspace.connectObject(
                'window-added', () => this._agendar('normalizar', () => this._normalizar()),
                this);
            this._workspacesObservados.push(workspace);
        }
    }

    _soltarWorkspaces() {
        for (const workspace of this._workspacesObservados)
            workspace.disconnectObject(this);
        this._workspacesObservados = [];
    }

    _agendar(chave, acao) {
        if (this._agendados.has(chave))
            return;
        const id = global.compositor.get_laters().add(Meta.LaterType.BEFORE_REDRAW, () => {
            this._agendados.delete(chave);
            acao();
            return GLib.SOURCE_REMOVE;
        });
        this._agendados.set(chave, id);
    }

    _cancelarAgendados() {
        const laters = global.compositor.get_laters();
        for (const id of this._agendados.values())
            laters.remove(id);
        this._agendados.clear();
    }

    _reavaliar() {
        this._config = lerConfiguracao({
            dinamicos: Meta.prefs_get_dynamic_workspaces(),
            apenasNoPrincipal: Meta.prefs_get_workspaces_only_on_primary(),
            total: global.workspace_manager.get_n_workspaces(),
        });
        this._observarWorkspaces();

        if (!this._config.valida) {
            this._avisar(this._config.problemas);
            return;
        }
        this._avisado = false;
        this._iniciar();
    }

    _avisar(problemas) {
        console.warn(`${PREFIXO} inativa: ${problemas.join('; ')}`);
        if (this._avisado)
            return;
        this._avisado = true;
        Main.notify('Workspaces por monitor está inativa', problemas.join('\n'));
    }

    _deveInterceptar() {
        return Boolean(this._config?.valida) && !this._passarDireto;
    }

    _iniciar() {
        if (!this._config?.valida)
            return;
        const ativo = global.workspace_manager.get_active_workspace_index();
        const descritas = this._descrever(this._janelasMoveis());
        const plano = planejarInicio(descritas, ativo, this._config, {
            monitores: Main.layoutManager.monitors.map(m => m.index),
            preferidos: this._visiveis,
        });
        this._aplicar(plano.movimentos, descritas);
        this._visiveis = plano.visiveis;
        if (ativo !== this._config.centro)
            this._voltarAoCentro();
    }

    _janelasMoveis() {
        return global.get_window_actors()
            .map(ator => ator.get_meta_window())
            .filter(janela => janela &&
                janela.get_window_type() === Meta.WindowType.NORMAL &&
                !janela.is_on_all_workspaces() &&
                !janela.get_transient_for() &&
                janela.get_workspace() !== null);
    }

    _descrever(janelas) {
        return janelas.map(janela => ({
            id: janela.get_id(),
            monitor: janela.get_monitor(),
            global: janela.get_workspace().index(),
            janela,
        }));
    }

    _doMonitor(monitor) {
        return this._descrever(this._janelasMoveis()).filter(d => d.monitor === monitor);
    }

    _aplicar(movimentos, descritas) {
        const porId = new Map(descritas.map(d => [d.id, d.janela]));
        for (const {id, global: destino} of movimentos)
            porId.get(id)?.change_workspace_by_index(destino, false);
    }

    _visivel(monitor) {
        return this._visiveis[monitor] ?? 1;
    }

    _contexto() {
        const foco = global.display.focus_window;
        return {
            ponteiro: global.display.get_current_monitor(),
            foco: foco ? foco.get_monitor() : null,
        };
    }

    _trocarNoMonitor(monitor, delta) {
        const descritas = this._doMonitor(monitor);
        const plano = planejarTroca(descritas, this._visivel(monitor), delta, this._config);
        if (plano === null)
            return false;
        this._aplicar(plano.movimentos, descritas);
        this._visiveis[monitor] = plano.visivel;
        return true;
    }

    _focarTopoDo(monitor) {
        const ativo = global.workspace_manager.get_active_workspace();
        const candidatas = this._janelasMoveis().filter(janela =>
            janela.get_monitor() === monitor &&
            janela.located_on_workspace(ativo) &&
            !janela.minimized);
        const topo = global.display.sort_windows_by_stacking(candidatas).at(-1);
        topo?.activate(global.get_current_time());
    }

    _voltarAoCentro() {
        this._passarDireto = true;
        try {
            global.workspace_manager
                .get_workspace_by_index(this._config.centro)
                .activate(global.get_current_time());
        } finally {
            this._passarDireto = false;
        }
    }

    _aoPedirWorkspace(destino) {
        if (this._arrastandoArquivo)
            return;
        const monitor = monitorDaAcao('ponteiro', this._contexto());
        if (this._trocarNoMonitor(monitor, deltaParaGlobal(destino, this._config)))
            this._focarTopoDo(monitor);
    }

    _aoPedirJanela(destino, janela, momento) {
        const monitor = janela.get_monitor();
        const delta = deltaParaJanela(destino, this._visivel(monitor), this._config);
        this._trocarNoMonitor(monitor, delta);
        janela.activate(momento);
    }

    _aoAtalho(args) {
        if (!this._config?.valida) {
            Main.wm._showWorkspaceSwitcher(...args);
            return;
        }

        const janela = args[1];
        const [acao, , , alvo] = args.at(-1).get_name().split('-');
        if (acao === 'move') {
            this._levarJanela(janela, alvo);
            return;
        }

        const monitor = monitorDaAcao('teclado', this._contexto());
        const delta = deltaParaAtalho(alvo, this._visivel(monitor), this._config);
        if (delta !== 0 && this._trocarNoMonitor(monitor, delta))
            this._focarTopoDo(monitor);
    }

    _levarJanela(janela, alvo) {
        if (!janela || janela.get_window_type() !== Meta.WindowType.NORMAL ||
            janela.is_on_all_workspaces())
            return;

        const monitor = janela.get_monitor();
        const visivel = this._visivel(monitor);
        const descritas = this._doMonitor(monitor);
        const plano = planejarLevarJanela(descritas, janela.get_id(), visivel,
            deltaParaAtalho(alvo, visivel, this._config), this._config);
        if (plano === null)
            return;

        this._aplicar(plano.movimentos, descritas);
        this._visiveis[monitor] = plano.visivel;
        janela.activate(global.get_current_time());
    }

    _aoTrocarGlobal() {
        if (!this._config?.valida || this._passarDireto)
            return;
        if (global.workspace_manager.get_active_workspace_index() === this._config.centro)
            return;
        this._agendar('compensar', () => this._compensar());
    }

    _compensar() {
        const ativo = global.workspace_manager.get_active_workspace();
        const indice = ativo.index();
        if (!this._config?.valida || indice === this._config.centro)
            return;

        const foco = global.display.focus_window;
        const monitor = monitorDaAcao('escape', {
            ponteiro: global.display.get_current_monitor(),
            foco: foco && foco.located_on_workspace(ativo) ? foco.get_monitor() : null,
        });
        this._trocarNoMonitor(monitor, deltaParaJanela(indice, this._visivel(monitor), this._config));
        console.log(`${PREFIXO} troca global para o workspace ${indice + 1} ` +
            `compensada no monitor ${monitor + 1}`);

        this._voltarAoCentro();
        if (foco?.located_on_workspace(global.workspace_manager.get_active_workspace()))
            foco.activate(global.get_current_time());
    }

    _normalizar() {
        if (!this._config?.valida)
            return;
        const descritas = this._descrever(this._janelasMoveis());
        for (const monitor of new Set(descritas.map(d => d.monitor))) {
            const doMonitor = descritas.filter(d => d.monitor === monitor);
            const plano = planejarTroca(doMonitor, this._visivel(monitor), 0, this._config);
            this._aplicar(plano.movimentos, doMonitor);
        }
    }
}
