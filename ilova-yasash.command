#!/bin/bash
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js o'rnatilmagan. https://nodejs.org saytidan LTS versiyasini o'rnating."; read -n1; exit 1; }
[ -d node_modules ] || { echo "Kutubxonalar o'rnatilmoqda, 1-3 daqiqa..."; npm install --no-audit --no-fund || exit 1; }
npm start
