import type { HerdrAgent } from '../types';
export function agentType(agent: HerdrAgent) {
  return agent.display_agent?.trim() || agent.agent?.trim() || 'Agent';
}
export function agentTaskLabel(agent: HerdrAgent) {
  const provider=agentType(agent);
  const explicit=agent.name?.trim();
  if (explicit && explicit.toLowerCase()!==provider.toLowerCase() && explicit.toLowerCase()!==agent.agent?.toLowerCase()) return explicit;
  if (agent.office_label?.trim()) return agent.office_label.trim();
  const title=agent.label?.trim()||agent.terminal_title_stripped?.trim()||agent.title?.trim();
  if (title && !['claude','claude code','codex','codex cli','grok','gemini cli'].includes(title.toLowerCase())) return title;
  return agent.cwd?.split('/').filter(Boolean).at(-1) || provider;
}
