#!/usr/bin/env bash
# Gera o executável para a plataforma atual (ou passe --win / --linux / --mac)
set -e
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js 22.13+ não encontrado."; exit 1; }
node scripts/build.mjs "$@"
