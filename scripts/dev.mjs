import { spawn } from 'node:child_process';
// Forward explicit preview flags to the webapp; preserve the normal full-stack dev command.
const args = process.argv.slice(2);
const child = args.includes('--strictPort')
  ? spawn(
      process.execPath,
      ['webapp/node_modules/vite/bin/vite.js', 'webapp', ...args],
      { stdio: 'inherit' }
    )
  : spawn(
      'npm',
      [
        'exec',
        '--',
        'concurrently',
        '-k',
        'npm --prefix webapp run dev',
        'node bot/server.js'
      ],
      { stdio: 'inherit' }
    );
child.on('exit', (code) => process.exit(code ?? 1));
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => child.kill(signal));
