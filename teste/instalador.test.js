import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const INSTALADOR = fileURLToPath(new URL('../instalar.sh', import.meta.url));

const GSETTINGS_FALSO = `#!/usr/bin/env bash
BANCO="$HOME/gsettings"
touch "$BANCO"
case "$1" in
  get)
    valor="$(grep "^$2 $3 " "$BANCO" | tail -1 | cut -d' ' -f3-)"
    if [ -z "$valor" ]; then
      case "$3" in
        num-workspaces) valor=4 ;;
        *) valor=true ;;
      esac
    fi
    echo "$valor" ;;
  set)
    grep -v "^$2 $3 " "$BANCO" > "$BANCO.novo" || true
    mv "$BANCO.novo" "$BANCO"
    echo "$2 $3 $4" >> "$BANCO" ;;
esac
`;

const GNOME_EXTENSIONS_FALSO = `#!/usr/bin/env bash
ATIVAS="$HOME/extensoes"
touch "$ATIVAS"
case "$1" in
  list) cat "$ATIVAS" ;;
  enable) grep -qx "$2" "$ATIVAS" || echo "$2" >> "$ATIVAS" ;;
  disable) grep -vx "$2" "$ATIVAS" > "$ATIVAS.novo" || true; mv "$ATIVAS.novo" "$ATIVAS" ;;
esac
`;

function novaMaquina(configuracao = {}) {
    const home = mkdtempSync(join(tmpdir(), 'instalador-'));
    mkdirSync(join(home, 'bin'));
    for (const [nome, conteudo] of [['gsettings', GSETTINGS_FALSO], ['gnome-extensions', GNOME_EXTENSIONS_FALSO]]) {
        writeFileSync(join(home, 'bin', nome), conteudo);
        chmodSync(join(home, 'bin', nome), 0o755);
    }
    const linhas = Object.entries(configuracao).map(([chave, valor]) => `${chave} ${valor}\n`);
    writeFileSync(join(home, 'gsettings'), linhas.join(''));
    return home;
}

function instalar(home, extras = {}) {
    const {POR_MONITOR: _ignorado, ...ambiente} = process.env;
    const resultado = spawnSync('bash', [INSTALADOR], {
        env: {...ambiente, HOME: home, PATH: `${join(home, 'bin')}:${process.env.PATH}`, ...extras},
        encoding: 'utf-8',
    });
    assert.equal(resultado.status, 0, resultado.stderr);
    return resultado.stdout;
}

function ler(home, chave) {
    const linhas = readFileSync(join(home, 'gsettings'), 'utf-8').trim().split('\n');
    const linha = linhas.filter(l => l.startsWith(`${chave} `)).at(-1);
    return linha?.split(' ').at(-1);
}

const NUMERO = 'org.gnome.desktop.wm.preferences num-workspaces';
const DINAMICOS = 'org.gnome.mutter dynamic-workspaces';
const SO_NO_PRINCIPAL = 'org.gnome.mutter workspaces-only-on-primary';

test('primeira instalação usa o padrão de 5 workspaces, mesmo com 3 fixos', () => {
    const home = novaMaquina({[DINAMICOS]: 'false', [NUMERO]: '3'});
    const saida = instalar(home);
    assert.equal(ler(home, NUMERO), '5');
    assert.match(saida, /padrão/);
});

test('reinstalar para atualizar mantém o número que o usuário escolheu', () => {
    const home = novaMaquina();
    instalar(home);
    writeFileSync(join(home, 'gsettings'), `${readFileSync(join(home, 'gsettings'), 'utf-8')}${NUMERO} 9\n`);
    const saida = instalar(home);
    assert.equal(ler(home, NUMERO), '9');
    assert.match(saida, /mantido/);
});

test('POR_MONITOR informado vale mesmo numa atualização', () => {
    const home = novaMaquina();
    instalar(home);
    writeFileSync(join(home, 'gsettings'), `${readFileSync(join(home, 'gsettings'), 'utf-8')}${NUMERO} 9\n`);
    const saida = instalar(home, {POR_MONITOR: '4'});
    assert.equal(ler(home, NUMERO), '7');
    assert.match(saida, /POR_MONITOR=4/);
});

test('atualização com número par volta para o padrão', () => {
    const home = novaMaquina();
    instalar(home);
    writeFileSync(join(home, 'gsettings'), `${readFileSync(join(home, 'gsettings'), 'utf-8')}${NUMERO} 6\n`);
    instalar(home);
    assert.equal(ler(home, NUMERO), '5');
});

test('o instalador sempre garante workspaces fixos e abrangendo as telas', () => {
    const home = novaMaquina();
    instalar(home);
    assert.equal(ler(home, DINAMICOS), 'false');
    assert.equal(ler(home, SO_NO_PRINCIPAL), 'false');
});
