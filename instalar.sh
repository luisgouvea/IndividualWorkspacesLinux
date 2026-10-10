#!/usr/bin/env bash
set -euo pipefail

ORIGEM="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UUID="workspaces-por-monitor@luisgouvea"
DESTINO="$HOME/.local/share/gnome-shell/extensions/$UUID"
ESTADO="$HOME/.local/share/workspaces-por-monitor"
POR_MONITOR="${POR_MONITOR:-3}"
TOTAL=$((2 * POR_MONITOR - 1))
CONFLITANTES=(
  "simulate-switching-workspaces-on-active-monitor@micheledaros.com"
  "smart-workspace-manager@local"
  "MaximizeWindowIntoNewWorkspace@kyleross.com"
)
CONFIGURACAO=(
  "org.gnome.mutter dynamic-workspaces false"
  "org.gnome.mutter workspaces-only-on-primary false"
  "org.gnome.desktop.wm.preferences num-workspaces $TOTAL"
)

info()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
aviso() { printf '\033[1;33m!!\033[0m %s\n' "$*"; }

mkdir -p "$ESTADO"

if [ ! -f "$ESTADO/configuracao-anterior" ]; then
  info "Guardando a configuração atual para o desinstalar.sh"
  for linha in "${CONFIGURACAO[@]}"; do
    read -r esquema chave _ <<<"$linha"
    echo "$esquema $chave $(gsettings get "$esquema" "$chave")"
  done > "$ESTADO/configuracao-anterior"
fi

info "Copiando a extensão para $DESTINO"
mkdir -p "$DESTINO"
cp "$ORIGEM/extensao/$UUID"/*.js "$ORIGEM/extensao/$UUID/metadata.json" "$DESTINO"/

info "Desativando extensões que disputam os mesmos workspaces"
for uuid in "${CONFLITANTES[@]}"; do
  if gnome-extensions list --enabled 2>/dev/null | grep -qx "$uuid"; then
    gnome-extensions disable "$uuid"
    echo "$uuid" >> "$ESTADO/extensoes-desativadas"
    echo "    desativada: $uuid"
  fi
done

info "Configurando $TOTAL workspaces fixos, abrangendo as telas ($POR_MONITOR por monitor)"
for linha in "${CONFIGURACAO[@]}"; do
  read -r esquema chave valor <<<"$linha"
  gsettings set "$esquema" "$chave" "$valor"
done

info "Habilitando $UUID"
gnome-extensions enable "$UUID" 2>/dev/null \
  || aviso "habilite depois do login com: gnome-extensions enable $UUID"

cat <<FIM

Pronto. No Wayland o GNOME só carrega extensão nova em sessão nova:
faça logout e login.

Conferir:  gnome-extensions info $UUID      (State: ACTIVE)
Log:       journalctl --user -f -o cat | grep workspaces-por-monitor
Desfazer:  $ORIGEM/desinstalar.sh
FIM
