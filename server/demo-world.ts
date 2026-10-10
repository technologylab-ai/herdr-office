import type { AgentStatus, HerdrAgent, HerdrLayout, HerdrPane, HerdrSnapshot, WorldState } from '../src/types.ts';
import { campusCompanies } from './demo-campus.ts';
import { socialDemo } from './demo-social.ts';

export type DemoLayout = 'base' | 'multi-lane' | 'campus' | 'showcase' | 'social';

type DemoTask = { title: string; provider?: string; status?: AgentStatus; idleMinutes?: number };
type DemoDepartment = { id?: string; name: string; tasks: DemoTask[]; rects: { x: number; y: number; width: number; height: number }[] };
const sideBySide = (left = 50) => [{ x: 0, y: 0, width: left, height: 100 }, { x: left, y: 0, width: 100 - left, height: 100 }];
const stacked = (top = 50) => [{ x: 0, y: 0, width: 100, height: top }, { x: 0, y: top, width: 100, height: 100 - top }];
const grid = [{ x: 0, y: 0, width: 50, height: 50 }, { x: 50, y: 0, width: 50, height: 50 },
  { x: 0, y: 50, width: 50, height: 50 }, { x: 50, y: 50, width: 50, height: 50 }];
const task = (title: string, provider: string, status: AgentStatus, idleMinutes?: number): DemoTask => ({ title, provider, status, idleMinutes });

// Every label, task, folder, terminal and machine below is fictional demo data.
// This module never imports the real bridge, Herdr, SSH or model executors.
export function createDemoFixture(now = Date.now(), layout: DemoLayout = 'base') {
  const output = new Map<string, string>();
  const definitions: { id: string; machineId: string; name: string; companies: { id?: string; name: string; folder: string; departments: DemoDepartment[] }[] }[] = [
    { id: 'demo:studio', machineId: 'demo-studio', name: 'Studio Mac', companies: [
      { name: 'Orbit Studio', folder: '/demo/orbit-studio', departments: [
        { name: 'Web App', rects: [{ x: 0, y: 0, width: 50, height: 100 }, { x: 50, y: 0, width: 50, height: 50 }, { x: 50, y: 50, width: 50, height: 50 }],
          tasks: [task('Check release notes', 'codex', 'idle', 7), task('Fix checkout focus trap', 'claude', 'working'), task('Add offline sync retry', 'claude', 'working')] },
        { name: 'Design System', rects: sideBySide(60), tasks: [task('Tune button contrast', 'gemini', 'done'), task('Update icon sprite', 'opencode', 'idle', 42)] },
      ] },
      { name: 'Northstar API', folder: '/demo/northstar-api', departments: [
        { name: 'Endpoints', rects: stacked(), tasks: [task('Paginate invoices endpoint', 'codex', 'working'), task('Migrate orders schema', 'claude', 'blocked')] },
        { name: 'Review', rects: sideBySide(70), tasks: [task('Review rate limiter PR', 'claude', 'working'), task('Write webhook tests', 'codex', 'done')] },
      ] },
      { name: 'Signal Lab', folder: '/demo/signal-lab', departments: [
        { name: 'Experiments', rects: grid, tasks: [task('Compare cache hit rates', 'gemini', 'working'), task('Summarize latency trace', 'claude', 'idle', 2),
          task('Clean benchmark dataset', 'codex', 'working'), { title: 'Demo shell' }] },
      ] },
    ] },
    { id: 'demo:build', machineId: 'demo-build', name: 'Build Node', companies: [
      { name: 'Northstar API', folder: '/demo/northstar-api', departments: [
        { name: 'Builds', rects: sideBySide(), tasks: [task('Build release candidate', 'codex', 'working'), task('Cache Docker layers', 'opencode', 'done')] },
        { name: 'Load Tests', rects: stacked(60), tasks: [task('Run checkout load test', 'claude', 'working'), task('Profile p95 latency', 'gemini', 'idle', 3)] },
      ] },
    ] },
  ];
  if (layout === 'multi-lane' || layout === 'campus' || layout === 'showcase' || layout === 'social') {
    // Clone the first row's split dimensions, so adding a second row does not
    // move its existing companies. The normal office mapper makes the lanes.
    const additional = [
      { name: 'Kestrel Forge', folder: '/demo/kestrel-forge', titles: ['Rig hero model', 'Bake light maps', 'Fix jump physics', 'Script level two', 'Cut launch trailer'] },
      { name: 'Bramble Pay', folder: '/demo/bramble-pay', titles: ['Retry failed payouts', 'Rotate webhook keys', 'Add refund endpoint', 'Reconcile ledger'] },
      { name: 'Tidewell Docs', folder: '/demo/tidewell-docs', titles: ['Index help articles', 'Translate setup guide', 'Fix broken links', 'Demo shell'] },
    ];
    if (layout === 'campus' || layout === 'showcase' || layout === 'social') additional.push(...campusCompanies.map(spec => ({ name: spec.name, titles: [...spec.titles],
      folder: `/demo/${spec.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    })));
    const originals = definitions[0].companies;
    const copies = additional.map((spec, index) => {
      const original = originals[index % 3]; let taskIndex = 0;
      return { name: spec.name, folder: spec.folder, departments: original.departments.map(department => ({
        ...department, rects: department.rects.map(rect => ({ ...rect })),
        tasks: department.tasks.map(item => ({ ...item, title: spec.titles[taskIndex++] })),
      })) };
    });
    definitions[0].companies.push(...copies);
  }
  if (layout === 'showcase') {
    // The teaser must show a large campus on either machine. Keep the original
    // Build Node project/IDs, then add the other invented campus projects.
    definitions[1].companies.push(...definitions[0].companies
      .filter(company => company.name !== 'Northstar API')
      .map(company => ({ ...company, departments: company.departments.map(department => ({
        ...department, rects: department.rects.map(rect => ({ ...rect })),
        tasks: department.tasks.map(item => ({ ...item })),
      })) })));
  }
  if (layout === 'social') {
    const secondary = definitions[1].companies[0];
    secondary.id = socialDemo.secondary.workspaceId;
    secondary.name = socialDemo.secondary.name;
    secondary.folder = socialDemo.secondary.folder;
    secondary.departments.forEach((department, index) => { department.id = socialDemo.secondary.departmentIds[index]; });
  }
  const connections = definitions.map(floor => {
    const snapshot: HerdrSnapshot = { version: '0.9.0-demo', protocol: 22, workspaces: [], tabs: [], panes: [], agents: [], layouts: [] };
    for (const [companyIndex, company] of floor.companies.entries()) {
      const workspaceId = company.id ?? `demo-w${companyIndex + 1}`;
      let paneNumber = 0;
      for (const [departmentIndex, department] of company.departments.entries()) {
        const tabId = department.id ?? `${workspaceId}:t${departmentIndex + 1}`;
        const layout: HerdrLayout = { workspace_id: workspaceId, tab_id: tabId, area: { x: 0, y: 0, width: 100, height: 100 }, panes: [], splits: [], zoomed: false, focused_pane_id: '' };
        for (const [index, spec] of department.tasks.entries()) {
          const paneId = `${workspaceId}:p${++paneNumber}`;
          const pane: HerdrPane = { pane_id: paneId, workspace_id: workspaceId, tab_id: tabId,
            terminal_id: `demo-terminal-${floor.machineId}-${paneId}`, agent: spec.provider ?? null,
            agent_status: spec.status ?? 'unknown', cwd: company.folder, terminal_title_stripped: spec.title,
            revision: 1, focused: index === 0, interactive_ready: !!spec.provider };
          snapshot.panes.push(pane);
          if (spec.provider) {
            const agent: HerdrAgent = { ...pane, status_since: new Date(now - (spec.idleMinutes ?? 0) * 60_000).toISOString(), status_since_source: 'observed' };
            snapshot.agents.push(agent);
          }
          layout.panes.push({ pane_id: paneId, rect: department.rects[index], focused: index === 0 });
          const lines = ['FICTIONAL DEMO OUTPUT', '', `${spec.provider ?? 'shell'} · ${spec.title}`, company.folder, ''];
          if (spec.title === 'Check release notes') lines.push('Release 2.4 review', '  ✓ Changelog collected', '  ✓ Upgrade checklist drafted', '  ? Migration notes need a final check', '', 'Ready for your next instruction.');
          else if (spec.status === 'blocked') lines.push('Proposed orders schema migration is ready.', 'Review requested before changing the schema.', '', 'Waiting for your direction.');
          else if (spec.status === 'working') lines.push('Reading project context…', 'Checking the current implementation…', 'Preparing the next change.');
          else if (spec.status === 'done') lines.push('Task complete.', 'Checks passed in this fictional example.', 'Ready for your next instruction.');
          else lines.push('Context is loaded.', 'Ready for your next instruction.');
          output.set(JSON.stringify([floor.id, paneId]), lines.join('\n'));
        }
        layout.focused_pane_id = layout.panes[0].pane_id;
        snapshot.layouts.push(layout);
        snapshot.tabs.push({ workspace_id: workspaceId, tab_id: tabId, label: department.name, number: departmentIndex + 1,
          agent_status: department.tasks.find(t => t.status === 'blocked') ? 'blocked' : department.tasks.find(t => t.status === 'working') ? 'working' : 'idle',
          pane_count: department.tasks.length, focused: departmentIndex === 0 });
      }
      snapshot.workspaces.push({ workspace_id: workspaceId, label: company.name, number: companyIndex + 1,
        active_tab_id: company.departments[0].id ?? `${workspaceId}:t1`, agent_status: 'working', tab_count: company.departments.length, pane_count: paneNumber, focused: companyIndex === 0 });
    }
    return { id: floor.id, machineId: floor.machineId, machineName: floor.name, sessionName: 'Launch Studio', online: true, snapshot };
  });
  const world: WorldState = { connections, updatedAt: new Date(now).toISOString() };
  return { world, output };
}
