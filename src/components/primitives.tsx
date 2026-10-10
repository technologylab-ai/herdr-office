import { Component, type ReactNode } from 'react';
import type { AgentStatus } from '../types';
import { STATUS_META } from './model';

export function StatusDot({ status, size = 'md' }: { status: AgentStatus | null; size?: 'sm' | 'md' }) {
  return <span className={`dot dot--${status ?? 'none'} dot--${size}`} aria-hidden="true" />;
}

export function StatusPill({ status }: { status: AgentStatus }) {
  return (
    <span className={`pill pill--${status}`} title={STATUS_META[status].hint}>
      <StatusDot status={status} size="sm" />
      {STATUS_META[status].label}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

/** technologylab mark: three floors of a building with a lit copper window. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--forest-700)" stroke="var(--line-strong)" />
      <path d="M8 23.5h16M8 17.5h16M8 11.5h16" stroke="var(--cream-200)" strokeWidth="1.6" strokeLinecap="round" opacity=".85" />
      <path d="M8 8v15.5M24 8v15.5" stroke="var(--cream-200)" strokeWidth="1.6" strokeLinecap="round" opacity=".35" />
      <rect x="17.5" y="13" width="4" height="3" rx=".8" fill="var(--copper-400)" />
    </svg>
  );
}

interface BoundaryProps { onError(message: string): void; children: ReactNode }
interface BoundaryState { failed: boolean }

/** Catches render-time crashes of the 3D scene so the rest of the office UI keeps working. */
export class SceneBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };
  static getDerivedStateFromError(): BoundaryState { return { failed: true }; }
  componentDidCatch(error: unknown) {
    this.props.onError(error instanceof Error ? error.message : String(error));
  }
  render() { return this.state.failed ? null : this.props.children; }
}
