import { resolve } from 'node:path';
import { HerdrBridge } from './herdr.ts';
import { createBridgeServer } from './http.ts';
import { AgentLabelService, codexLabelExecutor, LabelingError } from './naming.ts';

if (process.env.HERDR_ENV !== '1') {
  console.error('Start Herdr Office from a Herdr-managed terminal (HERDR_ENV=1). The bridge will not inspect a focused session from outside Herdr.');
  process.exit(1);
}
const bridge = new HerdrBridge();
const labelModel = process.env.HERDR_OFFICE_LABEL_MODEL || 'gpt-6-luna';
const labels = new AgentLabelService({
  enabled: labelModel !== 'off',
  executor: codexLabelExecutor(labelModel),
  onUpdate: () => { void bridge.refresh(); },
  onError: error => { console.warn(`Office task labeling is temporarily unavailable (${error instanceof LabelingError ? error.code : 'unknown'}); using Herdr titles. Retrying in five minutes.`); },
});
bridge.setWorldAnnotator(world => labels.annotate(world));
const { server, closeStreams } = createBridgeServer(bridge, { staticDir: process.argv.includes('--serve') ? resolve('dist') : undefined });
server.on('error', error => { console.error('Herdr Office bridge:', error.message); labels.stop(); bridge.stop(); process.exit(1); });
server.listen(4318, '127.0.0.1', () => console.log('Herdr Office bridge: http://127.0.0.1:4318'));
void bridge.start();
let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  labels.stop(); bridge.stop(); closeStreams(); server.close(() => process.exit(0)); server.closeIdleConnections();
  setTimeout(() => { server.closeAllConnections(); process.exit(0); }, 2_000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
