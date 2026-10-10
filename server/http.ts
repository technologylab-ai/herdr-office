import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { BridgeError, HerdrBridge } from './herdr.ts';

const ORIGINS = new Set(['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4318', 'http://127.0.0.1:4318']);
const HOSTS = new Set([...ORIGINS].map(o => new URL(o).host));
export function validateRequest(request: Pick<IncomingMessage, 'headers' | 'method'>): void {
  if (!HOSTS.has(request.headers.host || '')) throw new BridgeError(403, 'invalid_host', 'Only local Herdr Office hosts are allowed.');
  const origin = request.headers.origin;
  if (origin && !ORIGINS.has(origin)) throw new BridgeError(403, 'invalid_origin', 'Only the local Herdr Office app may access this bridge.');
  if (request.headers['sec-fetch-site'] === 'cross-site') throw new BridgeError(403, 'cross_site_request', 'Cross-site bridge requests are denied.');
  if (!['GET', 'HEAD'].includes(request.method || '') && !origin) throw new BridgeError(403, 'origin_required', 'Terminal input requires a local application origin.');
}
function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  response.end(JSON.stringify(value));
}
async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw new BridgeError(415, 'json_required', 'Use an application/json request body.');
  if (Number(request.headers['content-length'] || 0) > 40_000) throw new BridgeError(413, 'body_too_large', 'Request exceeds 40000 bytes.');
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 40_000) throw new BridgeError(413, 'body_too_large', 'Request exceeds 40000 bytes.');
    chunks.push(Buffer.from(chunk));
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch { throw new BridgeError(400, 'invalid_json', 'Request body must be a JSON object.'); }
}

const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
export function createBridgeServer(bridge: HerdrBridge, options: { staticDir?: string } = {}) {
  const streams = new Set<ServerResponse>();
  const server = createServer(async (request, response) => {
    try {
      validateRequest(request);
      const url = new URL(request.url || '/', 'http://127.0.0.1:4318');
      if (request.method === 'GET' && url.pathname === '/api/world') return json(response, 200, bridge.world);
      if (request.method === 'GET' && url.pathname === '/api/events') {
        if (streams.size >= 32) throw new BridgeError(429, 'too_many_streams', 'Too many open office event streams.');
        response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', 'connection': 'keep-alive', 'x-accel-buffering': 'no' });
        response.write(`event: world\ndata: ${JSON.stringify(bridge.world)}\n\n`);
        streams.add(response);
        request.on('close', () => streams.delete(response));
        return;
      }
      const read = /^\/api\/panes\/([^/]+)\/terminal$/.exec(url.pathname);
      if (request.method === 'GET' && read) {
        const result = await bridge.terminal(url.searchParams.get('connectionId'), decodeURIComponent(read[1]!), url.searchParams.get('source') || 'recent-unwrapped', Number(url.searchParams.get('lines') || '120'));
        return json(response, 200, result);
      }
      const prompt = /^\/api\/agents\/([^/]+)\/prompt$/.exec(url.pathname);
      const keys = /^\/api\/panes\/([^/]+)\/keys$/.exec(url.pathname);
      if (request.method === 'POST' && (prompt || keys)) {
        const data = await body(request);
        const paneId = decodeURIComponent((prompt || keys)![1]!);
        const result = prompt ? await bridge.prompt(data.connectionId, paneId, data.text, data.terminalId) : await bridge.keys(data.connectionId, paneId, data.keys, data.terminalId);
        return json(response, 200, { ok: true, result });
      }
      if (url.pathname.startsWith('/api/')) throw new BridgeError(404, 'route_not_found', 'API route not found.');
      if (options.staticDir && ['GET', 'HEAD'].includes(request.method || '')) {
        const root = resolve(options.staticDir);
        const path = resolve(root, '.' + decodeURIComponent(url.pathname));
        if (path !== root && !path.startsWith(root + sep)) throw new BridgeError(403, 'invalid_path', 'Invalid asset path.');
        let file = path;
        try { if (!(await stat(file)).isFile()) file = resolve(root, 'index.html'); }
        catch { if (extname(path)) throw new BridgeError(404, 'asset_not_found', 'Asset not found.'); file = resolve(root, 'index.html'); }
        const content = await readFile(file);
        response.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'x-content-type-options': 'nosniff', 'cache-control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600' });
        response.end(request.method === 'HEAD' ? undefined : content);
        return;
      }
      throw new BridgeError(404, 'route_not_found', 'Route not found.');
    } catch (error) {
      const err = error instanceof BridgeError ? error : new BridgeError(500, 'bridge_error', error instanceof Error ? error.message : String(error));
      if (!response.headersSent) json(response, err.status, { error: err.message, code: err.code });
      else response.end();
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  const broadcast = (data: string) => {
    for (const stream of streams) {
      // A healthy large world can exceed Node's high-water mark for one write.
      // Only disconnect a client whose queued bytes keep accumulating.
      if (stream.writableEnded || stream.destroyed || stream.writableLength > 1024 * 1024) { streams.delete(stream); stream.destroy(); }
      else stream.write(data);
    }
  };
  const unsubscribe = bridge.subscribe(world => broadcast(`event: world\ndata: ${JSON.stringify(world)}\n\n`));
  const heartbeat = setInterval(() => broadcast(': heartbeat\n\n'), 20_000);
  heartbeat.unref();
  server.on('close', () => { unsubscribe(); clearInterval(heartbeat); for (const stream of streams) stream.end(); streams.clear(); });
  return { server, closeStreams: () => { for (const stream of streams) stream.end(); streams.clear(); } };
}
