# Aurora Business Lab — Versão Desktop (Electron)

## Gerar o executável
Requisitos: Node.js 22.13+ (https://nodejs.org).

**Windows:** dê dois cliques em `build.bat` (ou `npm run build:win`)
**Linux/macOS:** `./build.sh` (ou `npm run build:linux` / `npm run build:mac`)

Saída em `dist/`:
- `Aurora Business Lab Setup 1.0.0.exe` — instalador
- `Aurora Business Lab-1.0.0-Portatil.exe` — portátil, sem instalação

Opções do script (`node scripts/build.mjs`): `--win`, `--mac`, `--linux`, `--dir` (teste rápido),
`--test` (roda vitest antes), `--clean`, `--skip-install`.

Testar sem empacotar: `npm install && npm run electron`

## Como funciona
- O Electron sobe o servidor Express/Socket.IO embutido e abre a janela em `http://localhost:3000`
  (se a porta estiver ocupada, usa a próxima livre).
- O servidor escuta na rede local: o professor abre o app e os alunos acessam pelo navegador em
  `http://IP-DO-PROFESSOR:3000`. Menu **Aurora → Endereço para os alunos** (Ctrl+E) mostra e copia o endereço.
- O banco SQLite e o segredo de sessão ficam na pasta de dados do usuário
  (Windows: `%APPDATA%\aurora-business-lab`), via `AURORA_DB_PATH`. Menu **Aurora → Abrir pasta de dados**.
- Os dados de `aurora.sqlite` do repositório NÃO são incluídos; cada instalação começa com banco limpo.

## Observações
- Windows: na 1ª execução o Firewall pedirá permissão — marque "Redes privadas" para os alunos conectarem.
- Gerar o `.exe` no Windows pode exigir terminal como Administrador ou Modo Desenvolvedor ativado
  (o electron-builder extrai ferramentas com links simbólicos). Em Linux, gerar `.exe` exige Wine.
- O executável não é assinado; o SmartScreen pode exibir aviso ("Mais informações → Executar assim mesmo").
- Telas usam CDNs (Chart.js, Three.js etc.): o computador do professor e dos alunos precisam de internet.
