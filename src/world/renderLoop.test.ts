import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVE_HOLD_MS, IDLE_FPS, createRenderLoop, type RenderDriver, type RenderLoop } from './renderLoop';

class Clock implements RenderDriver {
  time = 0;
  nextId = 0;
  rafCalls = 0;
  timerCalls = 0;
  maxRafs = 0;
  jobs = new Map<number, { at: number; raf: boolean; run: () => void }>();
  now = () => this.time;
  requestAnimationFrame = (callback: (now: number) => void) => {
    const id = ++this.nextId;
    this.jobs.set(id, { at: this.time + 16, raf: true, run: () => { this.rafCalls++; callback(this.time); } });
    this.maxRafs = Math.max(this.maxRafs, this.pendingRafs);
    return id;
  };
  cancelAnimationFrame = (id: number) => { this.jobs.delete(id); };
  setTimeout = (callback: () => void, delay: number) => {
    const id = ++this.nextId;
    this.jobs.set(id, { at: this.time + delay, raf: false, run: () => { this.timerCalls++; callback(); } });
    return id;
  };
  clearTimeout = (id: number) => { this.jobs.delete(id); };
  get pendingRafs() { return [...this.jobs.values()].filter(job => job.raf).length; }
  get pendingTimers() { return [...this.jobs.values()].filter(job => !job.raf).length; }
  advance(ms: number) {
    const end = this.time + ms;
    for (;;) {
      const next = [...this.jobs].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      this.time = next[1].at; this.jobs.delete(next[0]); next[1].run();
    }
    this.time = end;
  }
  stalledFrame(ms: number) {
    const next = [...this.jobs].find(([, job]) => job.raf);
    assert.ok(next, 'A real animation frame must be queued before simulating a stall.');
    this.time += ms; this.jobs.delete(next[0]); next[1].run();
  }
}

function setup(initialVisible = true) {
  const clock = new Clock();
  const frames: { now: number; dt: number }[] = [];
  const state = { active: false, visible: initialVisible };
  const loop = createRenderLoop({ driver: clock, draw: (now, dt) => frames.push({ now, dt }), isActive: () => state.active, isVisible: () => state.visible });
  return { clock, frames, state, loop };
}

test('stationary office does at most five idle RAF callbacks per second, with a timer between frames', () => {
  const { clock, frames, loop } = setup();
  clock.advance(16);
  assert.equal(frames.length, 1);
  assert.equal(clock.pendingRafs, 0);
  assert.equal(clock.pendingTimers, 1);
  clock.advance(10_000);
  assert.ok(frames.length <= 1 + 10 * IDLE_FPS);
  assert.ok(frames.length >= 1 + 10 * (IDLE_FPS - 1));
  assert.equal(clock.rafCalls, frames.length);
  assert.equal(clock.timerCalls, frames.length - 1);
  assert.equal(clock.maxRafs, 1);
  assert.equal(loop.isInteractive(), false);
  loop.dispose();
});

test('wake immediately cancels idle sleep, renews the interaction hold and cannot double queue', () => {
  const { clock, frames, loop } = setup();
  clock.advance(100);
  assert.equal(clock.pendingTimers, 1);
  loop.wake(); loop.wake(); loop.invalidate();
  assert.equal(clock.pendingTimers, 0);
  assert.equal(clock.pendingRafs, 1);
  assert.equal(loop.isInteractive(), true);
  clock.advance(16);
  assert.equal(frames.at(-1)!.now, 116);
  assert.equal(frames.at(-1)!.dt, 0, 'An idle gap cannot be credited to movement.');
  clock.advance(ACTIVE_HOLD_MS - 100);
  loop.wake();
  clock.advance(ACTIVE_HOLD_MS - 1);
  assert.equal(loop.isInteractive(), true);
  clock.advance(32);
  assert.equal(loop.isInteractive(), false);
  assert.equal(clock.pendingRafs, 0);
  assert.equal(clock.pendingTimers, 1);
  assert.equal(clock.maxRafs, 1);
  loop.dispose();
});

test('waking an idle frame already queued by its timer also resets the physics baseline', () => {
  const { clock, frames, loop } = setup();
  clock.advance(216);
  assert.equal(clock.pendingTimers, 0);
  assert.equal(clock.pendingRafs, 1);
  loop.wake(); clock.advance(16);
  assert.equal(frames.at(-1)!.dt, 0);
  loop.dispose();
});

test('invalidate renders once immediately without renewing interactive hold', () => {
  const { clock, frames, loop } = setup();
  clock.advance(100);
  loop.invalidate(); loop.invalidate();
  assert.equal(loop.isInteractive(), false);
  assert.equal(clock.pendingRafs, 1);
  clock.advance(16);
  assert.equal(frames.length, 2);
  assert.equal(clock.pendingRafs, 0);
  assert.equal(clock.pendingTimers, 1);
  clock.advance(180);
  assert.equal(frames.length, 2);
  loop.dispose();
});

test('active motion stays on native RAF after the hold, and caps long rendering stalls', () => {
  const { clock, frames, state, loop } = setup();
  state.active = true; loop.wake();
  clock.advance(1000);
  assert.ok(frames.length >= 60);
  assert.equal(clock.pendingTimers, 0);
  assert.equal(loop.isInteractive(), true);
  assert.equal(frames.at(-1)!.dt, .016);
  clock.stalledFrame(500);
  assert.equal(frames.at(-1)!.dt, .05);
  state.active = false;
  clock.advance(16);
  assert.equal(loop.isInteractive(), false);
  assert.equal(clock.pendingTimers, 1);
  loop.dispose();
});

test('hidden office schedules no work; becoming visible wakes with zero catchup timestep', () => {
  const { clock, frames, state, loop } = setup(false);
  loop.wake(); loop.invalidate(); clock.advance(1000);
  assert.equal(clock.jobs.size, 0); assert.equal(frames.length, 0);
  state.visible = true; loop.visibilityChanged(); clock.advance(32);
  assert.equal(frames[0]!.dt, 0); assert.equal(frames.length, 2);
  state.visible = false; loop.visibilityChanged();
  const count = frames.length;
  clock.advance(10_000);
  assert.equal(clock.jobs.size, 0); assert.equal(frames.length, count);
  state.visible = true; loop.visibilityChanged(); clock.advance(16);
  assert.equal(frames.at(-1)!.dt, 0);
  assert.equal(loop.isInteractive(), true);
  loop.dispose();
});

test('wake or invalidation during draw never creates a second RAF; disposal during draw leaves no orphan', () => {
  const clock = new Clock();
  let loop: RenderLoop;
  let calls = 0;
  loop = createRenderLoop({ driver: clock, isActive: () => false, isVisible: () => true, draw: () => {
    calls++;
    if (calls === 1) { loop.wake(); loop.invalidate(); loop.wake(); }
    else { loop.wake(); loop.dispose(); }
  } });
  clock.advance(1000);
  assert.equal(calls, 2);
  assert.equal(clock.maxRafs, 1);
  assert.equal(clock.jobs.size, 0);
  loop.wake(); loop.invalidate(); loop.visibilityChanged(); loop.dispose();
  clock.advance(1000);
  assert.equal(clock.jobs.size, 0); assert.equal(calls, 2);
  assert.equal(loop.isInteractive(), false);
});

test('dispose cancels either scheduled idle timers or interactive RAF callbacks permanently', () => {
  for (const interactive of [false, true]) {
    const { clock, frames, loop } = setup();
    clock.advance(16);
    if (interactive) loop.wake();
    assert.equal(interactive ? clock.pendingRafs : clock.pendingTimers, 1);
    const count = frames.length;
    loop.dispose(); loop.wake(); loop.invalidate(); loop.visibilityChanged();
    clock.advance(10_000);
    assert.equal(clock.jobs.size, 0); assert.equal(frames.length, count);
  }
});
