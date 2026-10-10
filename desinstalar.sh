#!/usr/bin/env bash
set -euo pipefail

UUID="workspaces-por-monitor@luisgouvea"
DESTINO="$HOME/.local/share/gnome-shell/extensions/$UUID"
ESTADO="$HOME/.local/share/workspaces-por-monitor"

info() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }

info "Desabilitando e removendo $UUID"
gnome-extensions disable "$UUID" 2>/dev/null || true
rm -rf "$DESTINO"

if [ -f "$ESTADO/configuracao-anterior" ]; then
  info "Restaurando a configuração de workspaces de antes da instalação"
  while read -r esquema chave valor; do
    gsettings set "$esquema" "$chave" "$valor"
  done < "$ESTADO/configuracao-anterior"
fi

if [ -f "$ESTADO/extensoes-desativadas" ]; then
  info "Religando as extensões que a instalação desativou"
  sort -u "$ESTADO/extensoes-desativadas" | while read -r uuid; do
    gnome-extensions enable "$uuid" 2>/dev/null && echo "    religada: $uuid" || true
  done
fi

rm -rf "$ESTADO"

cat <<'FIM'

Pronto. Faça logout e login para o GNOME descarregar a extensão.
FIM
