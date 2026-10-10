const FALSOS = new URL('./gnome-falso/', import.meta.url);

const MAPA = {
    'gi://Gio': 'gio.js',
    'gi://GLib': 'glib.js',
    'gi://Meta': 'meta.js',
    'gi://Shell': 'shell.js',
    'resource:///org/gnome/shell/ui/main.js': 'main.js',
    'resource:///org/gnome/shell/extensions/extension.js': 'extensao.js',
};

export function resolve(especificador, contexto, proximo) {
    if (especificador in MAPA)
        return {url: new URL(MAPA[especificador], FALSOS).href, shortCircuit: true};
    return proximo(especificador, contexto);
}
