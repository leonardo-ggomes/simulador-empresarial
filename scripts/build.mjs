import { spawnSync } from 'node:child_process';
import { rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const isWin = args.includes('--win') || process.platform === 'win32';
const isClean = args.includes('--clean');
const isDir = args.includes('--dir');
const isPortableOnly = args.includes('--portable');

if (isClean && existsSync('dist')) {
  console.log('Limpando pasta dist...');
  rmSync('dist', { recursive: true, force: true });
}

// Desativa tentativa de auto-descoberta de assinatura para evitar erros de symlink no Windows
process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';

const builderArgs = ['electron-builder'];

if (isDir) {
  builderArgs.push('--dir');
} else if (isPortableOnly) {
  builderArgs.push('--win', 'portable', '--x64');
} else if (isWin) {
  builderArgs.push('--win', '--x64');
}

const builderCmd = process.platform === 'win32' ? 'node_modules\\.bin\\electron-builder.cmd' : 'node_modules/.bin/electron-builder';

console.log(`Executando: ${builderCmd} ${builderArgs.slice(1).join(' ')}`);

const result = spawnSync(builderCmd, builderArgs.slice(1), {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}
