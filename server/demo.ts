import { createServer, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import type { AgentStatus } from '../src/types.ts';
import { createDemoFixture, type DemoLayout } from './demo-world.ts';
import { socialDemo } from './demo-social.ts';

export function createDemoServer(options: { staticDir: string; completionDelay?: number; activityScale?: number }) {
  let fixture = createDemoFixture(), generation = 0;
  let layout: DemoLayout = 'base';
  const streams = new Set<ServerResponse>(), timers = new Set<ReturnType<typeof setTimeout>>();
  const activities = new Map<string, Set<ReturnType<typeof setTimeout>>>();
  const staticDir = resolve(options.staticDir);
  const reply = (res: ServerResponse, status: number, data: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data));
  };
  const writeStream = (res: ServerResponse, frame: string) => {
    if (res.destroyed || res.writableEnded || res.writableLength > 1024 * 1024) { streams.delete(res); res.destroy(); }
    else res.write(frame);
  };
  const publish = () => {
    fixture.world.updatedAt = new Date().toISOString();
    const frame = `event: world\ndata: ${JSON.stringify(fixture.world)}\n\n`;
    for (const res of streams) writeStream(res, frame);
  };
  const setStatus = (connectionId: string, paneId: string, status: AgentStatus) => {
    const snapshot = fixture.world.connections.find(c => c.id === connectionId)?.snapshot;
    const agent = snapshot?.agents.find(a => a.pane_id === paneId);
    if (!agent || !snapshot) return false;
    agent.agent_status = status; agent.status_since = new Date().toISOString(); agent.status_since_source = 'observed';
    const pane = snapshot.panes.find(p => p.pane_id === paneId)!; pane.agent_status = status;
    publish(); return true;
  };
  const stopActivity = (key: string) => {
    for (const timer of activities.get(key) ?? []) { clearTimeout(timer); timers.delete(timer); }
    activities.delete(key);
  };
  const runActivity = (connectionId: string, paneId: string, initial: string,
    frames: { after: number; line: string; done?: boolean }[]) => {
    const key = JSON.stringify([connectionId, paneId]); stopActivity(key);
    const pending = new Set<ReturnType<typeof setTimeout>>(); activities.set(key, pending);
    const currentGeneration = generation;
    fixture.output.set(key, initial); setStatus(connectionId, paneId, 'working');
    for (const frame of frames) {
      const timer = setTimeout(() => {
        timers.delete(timer); pending.delete(timer);
        if (currentGeneration !== generation || activities.get(key) !== pending) return;
        fixture.output.set(key, `${fixture.output.get(key)}\n${frame.line}`);
        if (frame.done) setStatus(connectionId, paneId, 'done');
        if (!pending.size) activities.delete(key);
      }, frame.after * (options.activityScale ?? 1));
      pending.add(timer); timers.add(timer);
    }
  };
  const server = createServer(async (req, res) => {
    try {
      const address = server.address();
      const port = address && typeof address === 'object' ? address.port : undefined;
      const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
      if (!hosts.has(req.headers.host ?? '')) return reply(res, 403, { error: 'Only local demo hosts are allowed' });
      const origin = req.headers.origin;
      if (origin && ![...hosts].some(host => origin === `http://${host}`)) return reply(res, 403, { error: 'Cross-origin demo input rejected' });
      if (req.headers['sec-fetch-site'] === 'cross-site') return reply(res, 403, { error: 'Cross-site demo request rejected' });
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (req.method === 'GET' && url.pathname === '/api/demo/info') return reply(res, 200, { demo: true, isolated: true, fixture: 'launch-studio', layout });
      if (req.method === 'GET' && url.pathname === '/api/world') return reply(res, 200, fixture.world);
      if (req.method === 'GET' && url.pathname === '/api/events') {
        if (streams.size >= 32) return reply(res, 429, { error: 'Too many demo event streams' });
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        streams.add(res); res.write(`event: world\ndata: ${JSON.stringify(fixture.world)}\n\n`);
        const heartbeat = setInterval(() => writeStream(res, ': demo heartbeat\n\n'), 10_000);
        heartbeat.unref();
        res.on('close', () => { clearInterval(heartbeat); streams.delete(res); }); return;
      }
      const terminal = url.pathname.match(/^\/api\/panes\/([^/]+)\/terminal$/);
      if (req.method === 'GET' && terminal) {
        const key = JSON.stringify([url.searchParams.get('connectionId'), decodeURIComponent(terminal[1])]);
        const text = fixture.output.get(key);
        return reply(res, text === undefined ? 404 : 200, text === undefined ? { error: 'Unknown demo terminal' } : { text });
      }
      if (req.method === 'POST') {
        if (!origin) return reply(res, 403, { error: 'Demo input requires a local application origin' });
        if (!req.headers['content-type']?.startsWith('application/json')) return reply(res, 415, { error: 'Use JSON for demo input' });
        if (Number(req.headers['content-length'] ?? 0) > 16_384) return reply(res, 413, { error: 'Demo input too large' });
        const chunks: Buffer[] = []; let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 16_384) return reply(res, 413, { error: 'Demo input too large' });
          chunks.push(Buffer.from(chunk));
        }
        const raw = Buffer.concat(chunks).toString('utf8');
        let body: Record<string, unknown>;
        try { body = JSON.parse(raw); } catch { return reply(res, 400, { error: 'Invalid JSON' }); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(res, 400, { error: 'Invalid demo input' });
        if (url.pathname === '/api/demo/reset') {
          if (body.layout !== undefined && body.layout !== 'base' && body.layout !== 'multi-lane' && body.layout !== 'campus' && body.layout !== 'showcase' && body.layout !== 'social') return reply(res, 400, { error: 'Unknown demo layout' });
          layout = body.layout === 'social' ? 'social' : body.layout === 'showcase' ? 'showcase' : body.layout === 'campus' ? 'campus' : body.layout === 'multi-lane' ? 'multi-lane' : 'base';
          for (const timer of timers) clearTimeout(timer); timers.clear(); activities.clear(); generation++; fixture = createDemoFixture(Date.now(), layout); publish();
          return reply(res, 200, { demo: true, reset: true });
        }
        if (url.pathname === '/api/demo/status') {
          if (!['idle', 'working', 'blocked', 'done', 'unknown'].includes(String(body.status))) return reply(res, 400, { error: 'Invalid demo status' });
          return reply(res, setStatus(String(body.connectionId), String(body.paneId), body.status as AgentStatus) ? 200 : 404, { demo: true });
        }
        if (url.pathname === '/api/demo/activity') {
          const connectionId = String(body.connectionId), paneId = String(body.paneId);
          const agent = fixture.world.connections.find(c => c.id === connectionId)?.snapshot?.agents.find(a => a.pane_id === paneId);
          if (!agent) return reply(res, 404, { error: 'Unknown demo agent' });
          if (layout === 'social' && body.scenario === socialDemo.terminal.scenario && connectionId === socialDemo.terminal.connectionId && paneId === socialDemo.terminal.paneId && agent.terminal_title_stripped === socialDemo.terminal.title) {
            const lines = socialDemo.terminal.watchLines;
            const times = [400, 700, 1000, 1400, 1800, 2200];
            runActivity(connectionId, paneId, lines.slice(0, 6).join('\n'), lines.slice(6).map((line, index, rest) => ({ after: times[index], line, done: index === rest.length - 1 })));
            return reply(res, 200, { demo: true, scenario: socialDemo.terminal.scenario, duration: 2.2 });
          }
          if (body.scenario !== 'release-review' || agent.terminal_title_stripped !== 'Check release notes') return reply(res, 400, { error: 'Unknown demo activity' });
          const initial = ['FICTIONAL DEMO OUTPUT', '', 'codex · Check release notes', '/demo/orbit-studio', '', 'Reading CHANGELOG.md…'].join('\n');
          runActivity(connectionId, paneId, initial, [
            { after: 4000, line: 'Comparing merged changes for release 2.4…' },
            { after: 8000, line: 'Migration and rollback notes are missing.' },
            { after: 13000, line: 'Review complete. Ready for the next instruction.', done: true },
          ]);
          return reply(res, 200, { demo: true, scenario: 'release-review', duration: 16 });
        }
        const mutation = url.pathname.match(/^\/api\/(agents|panes)\/([^/]+)\/(prompt|keys)$/);
        if (mutation) {
          const connectionId = String(body.connectionId), paneId = decodeURIComponent(mutation[2]);
          const snapshot = fixture.world.connections.find(c => c.id === connectionId)?.snapshot;
          const pane = snapshot?.panes.find(p => p.pane_id === paneId);
          if (!pane) return reply(res, 404, { error: 'Unknown demo pane' });
          if (body.terminalId !== pane.terminal_id) return reply(res, 409, { error: 'Demo terminal replaced', code: 'target_changed' });
          const key = JSON.stringify([connectionId, paneId]);
          if (mutation[1] === 'agents' && mutation[3] === 'prompt') {
            const agent = snapshot!.agents.find(a => a.pane_id === paneId);
            if (!agent || !['idle', 'done'].includes(agent.agent_status)) return reply(res, 409, { error: 'Demo agent is not ready for a prompt' });
            if (typeof body.text !== 'string' || !body.text.trim()) return reply(res, 400, { error: 'A demo prompt is required' });
            if (layout === 'social' && connectionId === socialDemo.terminal.connectionId && paneId === socialDemo.terminal.paneId && body.text.trim() === socialDemo.terminal.prompt && agent.terminal_title_stripped === socialDemo.terminal.title) {
              const initial = [...socialDemo.terminal.watchLines.slice(0, 5), `> ${body.text.trim()}`, ''].join('\n');
              const times = [300, 600, 900, 1200, 1500, 1650, 1800];
              runActivity(connectionId, paneId, initial, socialDemo.terminal.resultLines.map((line, index, rest) => ({ after: times[index], line, done: index === rest.length - 1 })));
              return reply(res, 200, { ok: true, demo: true, result: { sent: true } });
            }
            if (body.text.trim() === 'Add migration and rollback notes first.' && agent.terminal_title_stripped === 'Check release notes') {
              const initial = ['FICTIONAL DEMO OUTPUT', '', 'codex · Check release notes', '/demo/orbit-studio', '',
                `> ${body.text.trim()}`, '', 'Instruction received.'].join('\n');
              runActivity(connectionId, paneId, initial, [
                { after: 1600, line: 'Prioritizing migration and rollback notes.' },
                { after: 3200, line: 'Writing docs/releases/2.4.md…' },
                { after: 4800, line: 'Checking migration steps and rollback examples…' },
                { after: 6400, line: 'Updated release notes. Checks passed. Ready for review.', done: true },
              ]);
              return reply(res, 200, { ok: true, demo: true, result: { sent: true } });
            }
            stopActivity(key);
            const previous = fixture.output.get(key) ?? 'FICTIONAL DEMO OUTPUT';
            fixture.output.set(key, `${previous}\n\n> ${body.text.trim()}\nReviewing the fictional release checklist…`);
            setStatus(connectionId, paneId, 'working');
            const currentGeneration = generation;
            const timer = setTimeout(() => {
              timers.delete(timer); if (generation !== currentGeneration) return;
              fixture.output.set(key, `${previous}\n\n> ${body.text}\n\nFICTIONAL DEMO RESPONSE\nRelease 2.4 still needs:\n  1. Migration and rollback notes\n  2. Accessibility changes\n  3. Known limitations\n\nReady for the next instruction.`);
              setStatus(connectionId, paneId, 'done');
            }, options.completionDelay ?? 1200);
            timers.add(timer);
          } else if (mutation[1] === 'panes' && mutation[3] === 'keys') {
            const allowed = ['up', 'down', 'tab', 'enter', 'esc', 'ctrl+c'];
            if (!Array.isArray(body.keys) || !body.keys.length || !body.keys.every(key => allowed.includes(String(key)))) return reply(res, 400, { error: 'Invalid demo terminal keys' });
            fixture.output.set(key, `${fixture.output.get(key)}\n[Demo key: ${body.keys.join(', ')}]`);
          } else return reply(res, 404, { error: 'Unknown demo operation' });
          return reply(res, 200, { ok: true, demo: true, result: { sent: true } });
        }
      }
      if (url.pathname.startsWith('/api/')) return reply(res, 404, { error: 'Unknown demo API; live APIs are unavailable' });
      if (req.method !== 'GET' && req.method !== 'HEAD') return reply(res, 405, { error: 'Method not allowed' });
      const decoded = decodeURIComponent(url.pathname);
      const path = resolve(staticDir, `.${decoded === '/' ? '/index.html' : decoded}`);
      if (!path.startsWith(`${staticDir}${sep}`)) return reply(res, 403, { error: 'Invalid demo asset path' });
      let bytes: Buffer;
      try { bytes = await readFile(path); } catch { return reply(res, 404, { error: 'Demo asset not found. Run npm run build first.' }); }
      const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
      res.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch { if (!res.headersSent) reply(res, 400, { error: 'Invalid demo request' }); else res.end(); }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  const close = () => { for (const timer of timers) clearTimeout(timer); timers.clear(); activities.clear(); for (const res of streams) res.end(); streams.clear(); };
  return { server, close };
}
