import { cp, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
try { process.loadEnvFile(path.join(root, '.env.local')); } catch (error) { if(error.code !== 'ENOENT') throw error; }
const standalone = path.join(root, '.next', 'standalone');
try { await access(path.join(standalone, 'server.js')); }
catch { throw new Error('請先執行 npm run build，再啟動正式預覽。'); }
await cp(path.join(root, 'public'), path.join(standalone, 'public'), { recursive: true });
await cp(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'), { recursive: true });
const child = spawn(process.execPath, [path.join(standalone, 'server.js')], {
  cwd: root, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production', HOSTNAME: process.env.SIGNAGE_HOST || '127.0.0.1', PORT: process.env.PORT || '3002', DATA_DIR: path.resolve(root, process.env.DATA_DIR || 'data') },
});
child.on('exit', code => process.exit(code ?? 0));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => child.kill(signal));