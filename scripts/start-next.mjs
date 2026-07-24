import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const port = process.env.PORT || '3000';

const child = spawn(process.execPath, [path.join(rootDir, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', port, '--hostname', '0.0.0.0'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
