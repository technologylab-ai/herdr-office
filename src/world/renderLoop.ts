export const IDLE_FPS = 5;
export const ACTIVE_HOLD_MS = 350;
const IDLE_INTERVAL_MS = 1000 / IDLE_FPS;

export interface RenderDriver {
  now(): number;
  requestAnimationFrame(callback: (now: number) => void): number;
  cancelAnimationFrame(handle: number): void;
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(handle: number): void;
}

export interface RenderLoopOptions {
  draw(now: number, dt: number): void;
  isActive(): boolean;
  isVisible(): boolean;
  driver?: RenderDriver;
}

export interface RenderLoop {
  wake(): void;
  invalidate(): void;
  visibilityChanged(): void;
  dispose(): void;
  isInteractive(): boolean;
}

/** Idle work consists of one timer and one RAF per rendered frame. Input wakes
 * native RAF immediately; idle/hidden time never becomes a movement timestep. */
export function createRenderLoop(options: RenderLoopOptions): RenderLoop {
  const driver: RenderDriver = options.driver ?? {
    now: () => performance.now(),
    requestAnimationFrame: callback => window.requestAnimationFrame(callback),
    cancelAnimationFrame: handle => window.cancelAnimationFrame(handle),
    setTimeout: (callback, delay) => window.setTimeout(callback, delay),
    clearTimeout: handle => window.clearTimeout(handle),
  };
  let raf: number | null = null;
  let timer: number | null = null;
  let drawing = false;
  let immediateRequested = false;
  let disposed = false;
  let sleeping = false;
  let previousTime: number | null = null;
  let holdUntil = -Infinity;

  const visible = () => !disposed && options.isVisible();
  const isInteractive = () => visible() && (options.isActive() || driver.now() <= holdUntil);
  function clearScheduled() {
    if (raf !== null) driver.cancelAnimationFrame(raf);
    if (timer !== null) driver.clearTimeout(timer);
    raf = timer = null;
  }
  function queueFrame() {
    if (!visible() || raf !== null || drawing) return;
    raf = driver.requestAnimationFrame(frame);
  }
  function queueIdleFrame() {
    if (!visible() || timer !== null || raf !== null) return;
    sleeping = true;
    timer = driver.setTimeout(() => {
      timer = null;
      queueFrame();
    }, IDLE_INTERVAL_MS);
  }
  function frame(now: number) {
    raf = null;
    if (!visible()) { previousTime = null; return; }
    if (sleeping) previousTime = null;
    sleeping = false;
    drawing = true;
    immediateRequested = false;
    const dt = previousTime === null ? 0 : Math.max(0, Math.min((now - previousTime) / 1000, .05));
    previousTime = now;
    try {
      options.draw(now, dt);
    } catch (error) {
      dispose();
      throw error;
    } finally {
      drawing = false;
      if (visible()) {
        if (immediateRequested || isInteractive()) queueFrame();
        else queueIdleFrame();
      }
    }
  }
  function requestImmediate(renewHold: boolean) {
    if (!visible()) return;
    // Preserve the normal timestep during continuous interaction; a sleeping
    // loop must begin with zero elapsed physics time instead.
    if (sleeping || previousTime === null) previousTime = null;
    sleeping = false;
    if (timer !== null) { driver.clearTimeout(timer); timer = null; }
    if (renewHold) holdUntil = driver.now() + ACTIVE_HOLD_MS;
    if (drawing) immediateRequested = true;
    else queueFrame();
  }
  function wake() { requestImmediate(true); }
  function invalidate() { requestImmediate(false); }
  function visibilityChanged() {
    if (disposed) return;
    clearScheduled();
    previousTime = null;
    holdUntil = -Infinity;
    if (visible()) wake();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    clearScheduled();
    previousTime = null;
    immediateRequested = false;
  }

  invalidate();
  return { wake, invalidate, visibilityChanged, dispose, isInteractive };
}
