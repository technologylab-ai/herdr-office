import { resolve } from 'node:path';
import { createDemoServer } from './demo.ts';

const port = Number(process.env.HERDR_OFFICE_DEMO_PORT ?? 5186);
if (!Number.isInteger(port) || port < 1024 || port > 65535 || [4318, 5173].includes(port)) throw new Error('Use a separate local port for the demo');
const { server, close } = createDemoServer({ staticDir: resolve('dist') });
server.listen(port, '127.0.0.1', () => console.log(`Herdr Office fictional demo: http://127.0.0.1:${port}\nNo Herdr session, SSH connection or model service is used.`));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { close(); server.close(); server.closeIdleConnections(); });
