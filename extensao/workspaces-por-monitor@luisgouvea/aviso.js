import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';

import * as Layout from 'resource:///org/gnome/shell/ui/layout.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const TEMPO_A_VISTA = 600;
const TEMPO_DO_FADE = 100;

export class AvisoDeWorkspace {
    constructor() {
        this._avisos = new Map();
    }

    mostrar(monitor, quantidade, atual) {
        const aviso = this._avisos.get(monitor) ?? this._criar(monitor);

        aviso.lista.destroy_all_children();
        for (let posicao = 1; posicao <= quantidade; posicao++) {
            const ponto = new St.Bin({style_class: 'ws-switcher-indicator'});
            if (posicao === atual)
                ponto.add_style_pseudo_class('active');
            aviso.lista.add_child(ponto);
        }

        if (aviso.temporizador)
            GLib.source_remove(aviso.temporizador);
        aviso.temporizador = GLib.timeout_add(GLib.PRIORITY_DEFAULT, TEMPO_A_VISTA, () => {
            aviso.temporizador = 0;
            this._esconder(monitor, aviso);
            return GLib.SOURCE_REMOVE;
        });

        aviso.ator.remove_all_transitions();
        aviso.ator.show();
        aviso.ator.opacity = 255;
    }

    esconderTodos() {
        for (const [monitor, aviso] of this._avisos)
            this._destruir(monitor, aviso);
    }

    _criar(monitor) {
        const ator = new Clutter.Actor({
            offscreen_redirect: Clutter.OffscreenRedirect.ALWAYS,
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.END,
            reactive: false,
        });
        ator.add_constraint(new Layout.MonitorConstraint({index: monitor}));

        const lista = new St.BoxLayout({style_class: 'workspace-switcher'});
        ator.add_child(lista);
        Main.uiGroup.add_child(ator);

        const aviso = {ator, lista, temporizador: 0};
        this._avisos.set(monitor, aviso);
        return aviso;
    }

    _esconder(monitor, aviso) {
        aviso.ator.ease({
            opacity: 0,
            duration: TEMPO_DO_FADE,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                if (this._avisos.get(monitor) === aviso && !aviso.temporizador)
                    this._destruir(monitor, aviso);
            },
        });
    }

    _destruir(monitor, aviso) {
        if (aviso.temporizador)
            GLib.source_remove(aviso.temporizador);
        aviso.temporizador = 0;
        aviso.ator.remove_all_transitions();
        aviso.ator.destroy();
        this._avisos.delete(monitor);
    }
}
