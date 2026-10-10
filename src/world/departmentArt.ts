// Generated wall art and head badges for the office. Pure browser Canvas 2D:
// no Three.js, no randomness that isn't seeded from the department identity,
// so a department always gets the same poster and different departments
// differ. Every word drawn comes from the caller (real Herdr names/counts).

const SERIF = "'Iowan Old Style', Charter, 'Palatino Linotype', Palatino, Georgia, serif";
const SANS = "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', 'Segoe UI', system-ui, sans-serif";

const BOARD_W = 1536;
const BOARD_H = 512;
const BADGE_W = 768;
const BADGE_H = 224;

type Ctx = CanvasRenderingContext2D;
type Rand = () => number;

/* ---------------------------------------------------------------- utilities */

/** FNV-1a: stable across sessions and browsers. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a tiny seeded PRNG; the only source of variation in a poster. */
function seeded(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(list: readonly T[], r: Rand): T => list[Math.floor(r() * list.length) % list.length]!;

function canvas(width: number, height: number): [HTMLCanvasElement, Ctx] {
  const el = document.createElement('canvas');
  el.width = width;
  el.height = height;
  const ctx = el.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable');
  return [el, ctx];
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function tracking(ctx: Ctx, px: number) {
  if ('letterSpacing' in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${px}px`;
}

/** Longest prefix of `text` (by code point) that fits `max` pixels, with an ellipsis if cut. */
function ellipsize(ctx: Ctx, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  const chars = Array.from(text);
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(`${chars.slice(0, mid).join('').trimEnd()}…`).width <= max) lo = mid;
    else hi = mid - 1;
  }
  return `${chars.slice(0, lo).join('').trimEnd()}…`;
}

/** Largest size in [min, max] at which `text` fits on one line; null if even `min` overflows. */
function fitSize(ctx: Ctx, text: string, font: (px: number) => string, width: number, max: number, min: number): number | null {
  for (let px = max; px >= min; px -= 2) {
    ctx.font = font(px);
    if (ctx.measureText(text).width <= width) return px;
  }
  return null;
}

/** Greedy word wrap into at most `lines` lines; the last line is ellipsized. */
function wrap(ctx: Ctx, text: string, width: number, lines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i]!;
    if (ctx.measureText(next).width <= width || !line) {
      line = next;
      continue;
    }
    out.push(line);
    line = words[i]!;
    if (out.length === lines - 1) {
      line = words.slice(i).join(' ');
      break;
    }
  }
  if (line) out.push(line);
  return out.slice(0, lines).map((l, i, all) => (i === all.length - 1 ? ellipsize(ctx, l, width) : l));
}

function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/* ---------------------------------------------------------------- schemes */

interface Scheme {
  key: string;
  /** Poster ground; two values make a vertical gradient. */
  ground: [string, string];
  card: string;
  cardEdge: string;
  ink: string;
  sub: string;
  muted: string;
  accents: [string, string, string, string, string];
  wall: string;
  slat: string;
  motif(ctx: Ctx, s: Scheme, r: Rand): void;
}

/* Art is composed for the right two-thirds; the title card covers the left. */
const ART_X = 640;

function bauhaus(ctx: Ctx, s: Scheme, r: Rand) {
  const size = 128;
  const colors = s.accents;
  for (let row = 0; row < BOARD_H / size; row++) {
    for (let col = 0; col < BOARD_W / size; col++) {
      const x = col * size;
      const y = row * size;
      // Most tiles stay on the paper ground so the field breathes.
      const bg = r() < 0.62 ? s.ground[0] : pick(colors, r);
      let fg = pick(colors, r);
      if (fg === bg) fg = colors[(colors.indexOf(fg) + 2) % colors.length]!;
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = fg;
      ctx.beginPath();
      const kind = Math.floor(r() * 6);
      const corner = Math.floor(r() * 4);
      if (kind <= 1) {
        const cx = x + (corner === 1 || corner === 2 ? size : 0);
        const cy = y + (corner >= 2 ? size : 0);
        const start = [0, 0.5, 1, 1.5][corner]! * Math.PI;
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, size, start, start + Math.PI / 2);
      } else if (kind === 2) {
        const pts: [number, number, number][] = [[x + size / 2, y, 0], [x + size, y + size / 2, 0.5], [x + size / 2, y + size, 1], [x, y + size / 2, 1.5]];
        const [cx, cy, a] = pts[corner]!;
        ctx.arc(cx, cy, size / 2, a * Math.PI, a * Math.PI + Math.PI);
      } else if (kind === 3) {
        ctx.arc(x + size / 2, y + size / 2, size * 0.32, 0, Math.PI * 2);
      } else if (kind === 4) {
        const c = [[x, y], [x + size, y], [x + size, y + size], [x, y + size]];
        ctx.moveTo(c[corner]![0]!, c[corner]![1]!);
        ctx.lineTo(c[(corner + 1) % 4]![0]!, c[(corner + 1) % 4]![1]!);
        ctx.lineTo(c[(corner + 3) % 4]![0]!, c[(corner + 3) % 4]![1]!);
      } else {
        for (let i = 0; i < 4; i++) ctx.rect(x + 14, y + 18 + i * 26, size - 28, 10);
      }
      ctx.fill();
    }
  }
}

function contours(ctx: Ctx, s: Scheme, r: Rand) {
  const peaks = Array.from({ length: 3 }, (_, i) => ({
    x: ART_X + 160 + i * 300 + (r() - 0.5) * 140,
    y: 120 + r() * 280,
    a: r() * 6, b: r() * 6, c: r() * 6,
    levels: 9 + Math.floor(r() * 6),
  }));
  ctx.lineJoin = 'round';
  for (const p of peaks) {
    for (let k = p.levels; k >= 0; k--) {
      const base = 16 + k * 24;
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const t = (i / 120) * Math.PI * 2;
        const rr = base * (1 + 0.17 * Math.sin(3 * t + p.a) + 0.09 * Math.sin(5 * t + p.b) + 0.05 * Math.sin(7 * t + p.c + k * 0.2));
        const x = p.x + Math.cos(t) * rr * 1.25;
        const y = p.y + Math.sin(t) * rr;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      if (k < 3) {
        ctx.fillStyle = withAlpha(s.accents[k === 0 ? 2 : 1], k === 0 ? 0.9 : 0.35);
        ctx.fill();
      }
      const index = k % 4 === 0;
      ctx.strokeStyle = withAlpha(s.accents[0], index ? 0.9 : 0.5);
      ctx.lineWidth = index ? 3.2 : 1.6;
      ctx.stroke();
    }
  }
  // Survey marks: a quiet grid of crosses.
  ctx.strokeStyle = withAlpha(s.accents[3], 0.55);
  ctx.lineWidth = 2;
  for (let x = ART_X + 40; x < BOARD_W; x += 96) {
    for (let y = 48; y < BOARD_H; y += 96) {
      ctx.beginPath();
      ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y);
      ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 6);
      ctx.stroke();
    }
  }
}

function archPath(ctx: Ctx, x: number, top: number, w: number, bottom: number) {
  ctx.beginPath();
  ctx.moveTo(x, bottom);
  ctx.lineTo(x, top);
  ctx.arc(x + w / 2, top, w / 2, Math.PI, 0);
  ctx.lineTo(x + w, bottom);
  ctx.closePath();
}

function arches(ctx: Ctx, s: Scheme, r: Rand) {
  const [a0, a1, a2, a3, a4] = s.accents;
  ctx.fillStyle = a2;
  ctx.beginPath();
  ctx.arc(ART_X + 380 + r() * 360, 150 + r() * 40, 120 + r() * 40, 0, Math.PI * 2);
  ctx.fill();
  const n = 5 + Math.floor(r() * 2);
  const span = BOARD_W - ART_X + 40;
  const w = span / n;
  for (let i = 0; i < n; i++) {
    const x = ART_X - 20 + i * w;
    const top = 210 + ((i + Math.floor(r() * 2)) % 2) * 46;
    archPath(ctx, x + 8, top, w - 16, BOARD_H);
    ctx.fillStyle = i % 2 ? a1 : a0;
    ctx.fill();
    archPath(ctx, x + 30, top + 20, w - 60, BOARD_H);
    ctx.fillStyle = a3;
    ctx.fill();
    archPath(ctx, x + 50, top + 44, w - 100, BOARD_H);
    ctx.fillStyle = i % 3 === 1 ? a2 : a4;
    ctx.fill();
  }
  ctx.fillStyle = a4;
  ctx.fillRect(0, BOARD_H - 26, BOARD_W, 26);
}

function ridgelines(ctx: Ctx, s: Scheme, r: Rand) {
  const lines = 17;
  const phases = Array.from({ length: lines }, () => [r() * 6, r() * 6, r() * 6] as const);
  const centre = ART_X + 380 + r() * 200;
  for (let i = 0; i < lines; i++) {
    const baseY = 96 + i * 23;
    const [p1, p2, p3] = phases[i]!;
    const trace = new Path2D();
    for (let x = ART_X - 40; x <= BOARD_W + 8; x += 6) {
      const d = (x - centre - Math.sin(i * 0.6) * 90) / 170;
      const envelope = Math.exp(-d * d);
      const noise = 0.55 + 0.25 * Math.sin(x / 23 + p1) + 0.15 * Math.sin(x / 9 + p2) + 0.1 * Math.sin(x / 41 + p3);
      const y = baseY - envelope * noise * 92;
      if (x === ART_X - 40) trace.moveTo(x, y); else trace.lineTo(x, y);
    }
    // Fill below the trace so nearer ridges hide the ones behind them.
    const body = new Path2D(trace);
    body.lineTo(BOARD_W + 8, BOARD_H + 8);
    body.lineTo(ART_X - 40, BOARD_H + 8);
    body.closePath();
    ctx.fillStyle = s.ground[1];
    ctx.fill(body);
    const t = i / (lines - 1);
    ctx.strokeStyle = t < 0.5 ? s.accents[0] : s.accents[1];
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * Math.PI);
    ctx.lineWidth = i % 4 === 0 ? 3 : 1.8;
    ctx.stroke(trace);
    ctx.globalAlpha = 1;
  }
  // A single highlighted reading, like a selected trace.
  ctx.fillStyle = s.accents[2];
  ctx.beginPath();
  ctx.arc(centre, 96 + 8 * 23 - 70, 9, 0, Math.PI * 2);
  ctx.fill();
}

function isometric(ctx: Ctx, s: Scheme, r: Rand) {
  const size = 54;
  const a = size * 0.866;
  const b = size * 0.5;
  const ox = ART_X + 460;
  const oy = -70;
  const [top, left, right, hi, hiDark] = s.accents;
  const cells: { gx: number; gy: number; h: number; lit: boolean }[] = [];
  for (let gx = 0; gx < 10; gx++) {
    for (let gy = 0; gy < 10; gy++) {
      const v = r();
      cells.push({ gx, gy, h: v < 0.22 ? 0 : v < 0.7 ? 1 : v < 0.92 ? 2 : 3, lit: r() < 0.07 });
    }
  }
  cells.sort((p, q) => p.gx + p.gy - (q.gx + q.gy));
  for (const c of cells) {
    const cx = ox + (c.gx - c.gy) * a;
    const by = oy + (c.gx + c.gy) * b + size * 2;
    for (let z = 0; z < c.h; z++) {
      const cy = by - z * size;
      const faces: [string, [number, number][]][] = [
        [c.lit ? hi : top, [[cx, cy], [cx + a, cy + b], [cx, cy + 2 * b], [cx - a, cy + b]]],
        [c.lit ? hiDark : left, [[cx - a, cy + b], [cx, cy + 2 * b], [cx, cy + 2 * b + size], [cx - a, cy + b + size]]],
        [c.lit ? hiDark : right, [[cx, cy + 2 * b], [cx + a, cy + b], [cx + a, cy + b + size], [cx, cy + 2 * b + size]]],
      ];
      for (const [color, pts] of faces) {
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = withAlpha(s.ground[0], 0.35);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      if (c.lit) break;
    }
  }
}

function molecules(ctx: Ctx, s: Scheme, r: Rand) {
  const R = 44;
  const dx = R * 1.5;
  const dy = R * Math.sqrt(3);
  const centres: { x: number; y: number }[] = [];
  for (let col = 0; ART_X - 60 + col * dx < BOARD_W + R; col++) {
    for (let row = -1; row * dy < BOARD_H + R; row++) {
      centres.push({ x: ART_X - 60 + col * dx, y: row * dy + (col % 2 ? dy / 2 : 0) });
    }
  }
  for (const c of centres) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const t = (Math.PI / 3) * i;
      ctx.lineTo(c.x + Math.cos(t) * (R - 3), c.y + Math.sin(t) * (R - 3));
    }
    ctx.closePath();
    if (r() < 0.16) {
      ctx.fillStyle = withAlpha(s.accents[1], 0.55);
      ctx.fill();
    }
    ctx.strokeStyle = withAlpha(s.accents[0], 0.6);
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  const near = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.abs(Math.hypot(p.x - q.x, p.y - q.y) - dy) < 2;
  const inArt = centres.filter((c) => c.x > ART_X + 40 && c.x < BOARD_W - 40 && c.y > 50 && c.y < BOARD_H - 50);
  for (let m = 0; m < 2; m++) {
    let at = pick(inArt, r);
    const chain = [at];
    for (let step = 0; step < 7; step++) {
      const options = inArt.filter((c) => near(c, at) && !chain.includes(c));
      if (!options.length) break;
      at = pick(options, r);
      chain.push(at);
    }
    ctx.strokeStyle = s.accents[3];
    ctx.lineCap = 'round';
    for (let i = 1; i < chain.length; i++) {
      const p = chain[i - 1]!;
      const q = chain[i]!;
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      if (i % 3 === 0) {
        // A double bond: a thin parallel stroke.
        const nx = -(q.y - p.y) / dy * 11;
        const ny = (q.x - p.x) / dy * 11;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(p.x + nx, p.y + ny); ctx.lineTo(q.x + nx, q.y + ny); ctx.stroke();
      }
    }
    chain.forEach((c, i) => {
      ctx.fillStyle = i % 3 === 0 ? s.accents[2] : s.accents[3];
      ctx.beginPath(); ctx.arc(c.x, c.y, i % 3 === 0 ? 16 : 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = s.ground[0];
      ctx.lineWidth = 3;
      ctx.stroke();
    });
  }
}

function sunburst(ctx: Ctx, s: Scheme, r: Rand) {
  const ox = ART_X + 420 + r() * 220;
  const oy = BOARD_H + 30;
  const rays = 28;
  for (let i = 0; i < rays; i += 2) {
    const t0 = Math.PI + (i / rays) * Math.PI;
    const t1 = Math.PI + ((i + 1) / rays) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.arc(ox, oy, 1400, t0, t1);
    ctx.closePath();
    ctx.fillStyle = withAlpha(s.accents[3], 0.35);
    ctx.fill();
  }
  ctx.lineCap = 'butt';
  for (let k = 0; k < 7; k++) {
    const radius = 130 + k * 52;
    const span = 0.55 + r() * 0.45;
    const start = Math.PI + r() * (1 - span) * Math.PI;
    ctx.beginPath();
    ctx.arc(ox, oy, radius, start, start + span * Math.PI);
    ctx.strokeStyle = s.accents[k % 3];
    ctx.lineWidth = 30;
    ctx.stroke();
  }
  ctx.fillStyle = s.accents[4];
  ctx.beginPath();
  ctx.arc(ox, oy, 96, Math.PI, 0);
  ctx.fill();
}

function blueprint(ctx: Ctx, s: Scheme, r: Rand) {
  const line = s.accents[0];
  for (let x = 0; x < BOARD_W; x += 16) {
    ctx.fillStyle = withAlpha(line, x % 64 === 0 ? 0.2 : 0.07);
    ctx.fillRect(x, 0, 1, BOARD_H);
  }
  for (let y = 0; y < BOARD_H; y += 16) {
    ctx.fillStyle = withAlpha(line, y % 64 === 0 ? 0.2 : 0.07);
    ctx.fillRect(0, y, BOARD_W, 1);
  }
  ctx.strokeStyle = withAlpha(line, 0.85);
  ctx.lineWidth = 3;
  // A floor plan: outer walls, a few rooms, door swings.
  const px = ART_X + 96;
  const py = 80;
  const pw = 448 + Math.floor(r() * 3) * 64;
  const ph = 320;
  ctx.strokeRect(px, py, pw, ph);
  ctx.strokeRect(px + 8, py + 8, pw - 16, ph - 16);
  const split = px + 128 + Math.floor(r() * 3) * 64;
  ctx.beginPath();
  ctx.moveTo(split, py + 8); ctx.lineTo(split, py + ph - 120);
  ctx.moveTo(px + 8, py + 192); ctx.lineTo(split - 64, py + 192);
  ctx.stroke();
  ctx.lineWidth = 1.6;
  for (const [dx, dy, a] of [[split, py + ph - 120, 0.5], [split - 64, py + 192, 0]] as const) {
    ctx.beginPath();
    ctx.moveTo(dx, dy);
    ctx.arc(dx, dy, 56, a * Math.PI, a * Math.PI + Math.PI / 2);
    ctx.stroke();
  }
  // Dimension line with ticks.
  ctx.beginPath();
  ctx.moveTo(px, py - 34); ctx.lineTo(px + pw, py - 34);
  for (let x = px; x <= px + pw; x += 64) { ctx.moveTo(x, py - 42); ctx.lineTo(x, py - 26); }
  ctx.stroke();
  // Drafting circles, one picked out in pencil yellow.
  const cx = px + pw + 150;
  const cy = 250 + (r() - 0.5) * 80;
  for (const [rad, color, w] of [[118, line, 2], [78, s.accents[1], 4], [30, line, 2]] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.strokeStyle = withAlpha(line, 0.7);
  ctx.lineWidth = 1.4;
  ctx.setLineDash([10, 6]);
  ctx.beginPath();
  ctx.moveTo(cx - 150, cy); ctx.lineTo(cx + 150, cy);
  ctx.moveTo(cx, cy - 150); ctx.lineTo(cx, cy + 150);
  ctx.stroke();
  ctx.setLineDash([]);
}

// Eight families, each with its own colour story, all tuned to sit on warm
// oak floors under copper light. Walls are mid-depth so the posters glow.
const SCHEMES: Scheme[] = [
  {
    key: 'terracotta-studio', ground: ['#efe4cf', '#efe4cf'], card: '#fbf6ec', cardEdge: 'rgba(31,42,54,0.10)',
    ink: '#1f2a36', sub: '#b4532f', muted: '#6b6558',
    accents: ['#c4643f', '#e0a63a', '#2f4a6d', '#7e9a77', '#1f2a36'],
    wall: '#34485f', slat: '#b07d4f', motif: bauhaus,
  },
  {
    key: 'alpine-survey', ground: ['#dfe7dc', '#d5e0d2'], card: '#f6f8f1', cardEdge: 'rgba(29,51,40,0.12)',
    ink: '#1d3328', sub: '#2f6e50', muted: '#5f6d63',
    accents: ['#3d6650', '#9cc0a4', '#c79c5a', '#7d9184', '#1d3328'],
    wall: '#2f4a3f', slat: '#a07448', motif: contours,
  },
  {
    key: 'rose-arcade', ground: ['#f5dfd3', '#e9b9a7'], card: '#fff6f0', cardEdge: 'rgba(62,34,51,0.12)',
    ink: '#3e2233', sub: '#a64a60', muted: '#7a5f66',
    accents: ['#b5576b', '#7a3a52', '#efa47f', '#f7e6d8', '#4b2a3c'],
    wall: '#4a3340', slat: '#c4976a', motif: arches,
  },
  {
    key: 'night-signal', ground: ['#16233d', '#16233d'], card: '#1e2f50', cardEdge: 'rgba(244,236,216,0.16)',
    ink: '#f4ecd8', sub: '#f2b880', muted: '#a9b3c6',
    accents: ['#f2b880', '#e9e2c9', '#ef7f5a', '#8796b8', '#0d1527'],
    wall: '#253349', slat: '#7a5236', motif: ridgelines,
  },
  {
    key: 'slate-blocks', ground: ['#e7ecef', '#dbe2e7'], card: '#f8fafb', cardEdge: 'rgba(36,49,60,0.12)',
    ink: '#24313c', sub: '#4f6577', muted: '#66727c',
    accents: ['#d5dde3', '#93a6b4', '#5b6f80', '#e2a072', '#b5683d'],
    wall: '#47535e', slat: '#b88a5a', motif: isometric,
  },
  {
    key: 'lab-teal', ground: ['#173b3a', '#123130'], card: '#0f2b2a', cardEdge: 'rgba(238,243,232,0.16)',
    ink: '#eef3e8', sub: '#f0b27a', muted: '#9db8ae',
    accents: ['#3d746c', '#2a5f58', '#f09a6a', '#efe3bd', '#0b2221'],
    wall: '#1f3d3c', slat: '#93623f', motif: molecules,
  },
  {
    key: 'ochre-hour', ground: ['#f5e6c6', '#f0d9ab'], card: '#fff8ea', cardEdge: 'rgba(58,37,22,0.12)',
    ink: '#3a2516', sub: '#a8481f', muted: '#76604c',
    accents: ['#d9902f', '#b4532a', '#7c3b22', '#f2c879', '#2e3b33'],
    wall: '#56402f', slat: '#c79c6c', motif: sunburst,
  },
  {
    key: 'drafting-room', ground: ['#22407a', '#1d3768'], card: '#1a3263', cardEdge: 'rgba(207,224,255,0.22)',
    ink: '#f4f7ff', sub: '#ffd27a', muted: '#b7c6e6',
    accents: ['#cfe0ff', '#ffd27a', '#8fb0f0', '#e7eefc', '#132a55'],
    wall: '#2a3552', slat: '#a8774c', motif: blueprint,
  },
];

function schemeFor(identity: string): Scheme {
  return SCHEMES[hash(identity) % SCHEMES.length]!;
}

/**
 * The wall and wood-slat colours that belong with a department's poster, so the
 * scene can paint the feature wall to match. Stable for a given identity.
 */
export function departmentScheme(identity: string): { key: string; wall: string; slat: string; accent: string } {
  const s = schemeFor(identity);
  return { key: s.key, wall: s.wall, slat: s.slat, accent: s.sub };
}

/* ---------------------------------------------------------------- board */

/**
 * A 1536×512 (3:1) wall poster: company, department and head count on a title
 * card at the left; a generated composition in the department's scheme on the right.
 */
export function createDepartmentBoard(company: string, department: string, people: number, identity: string): HTMLCanvasElement {
  const [el, ctx] = canvas(BOARD_W, BOARD_H);
  const s = schemeFor(identity);
  const r = seeded(hash(`${identity}\u0000art`));

  const ground = ctx.createLinearGradient(0, 0, 0, BOARD_H);
  ground.addColorStop(0, s.ground[0]);
  ground.addColorStop(1, s.ground[1]);
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, BOARD_W, BOARD_H);

  ctx.save();
  s.motif(ctx, s, r);
  ctx.restore();

  // Title card.
  const cx = 40;
  const cy = 40;
  const cw = 600;
  const ch = BOARD_H - 80;
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 10;
  roundRect(ctx, cx, cy, cw, ch, 30);
  ctx.fillStyle = s.card;
  ctx.fill();
  ctx.restore();
  roundRect(ctx, cx + 1, cy + 1, cw - 2, ch - 2, 29);
  ctx.strokeStyle = s.cardEdge;
  ctx.lineWidth = 2;
  ctx.stroke();

  const pad = 52;
  const tx = cx + pad;
  const tw = cw - pad * 2;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // Company: as large as fits on one line, else two lines.
  const companyName = company.trim() || 'Company';
  const serif = (px: number) => `600 ${px}px ${SERIF}`;
  tracking(ctx, -1);
  let size = fitSize(ctx, companyName, serif, tw, 92, 64);
  let lines: string[];
  if (size) {
    ctx.font = serif(size);
    lines = [companyName];
  } else {
    size = 64;
    ctx.font = serif(size);
    lines = wrap(ctx, companyName, tw, 2);
  }
  ctx.fillStyle = s.ink;
  let y = cy + 58 + size * 0.82;
  for (const line of lines) {
    ctx.fillText(line, tx, y);
    y += size * 1.02;
  }
  tracking(ctx, 0);

  // Accent rule in the scheme's colours.
  y += 6;
  s.accents.slice(0, 3).forEach((c, i) => {
    roundRect(ctx, tx + i * 30, y - 6, 22, 8, 4);
    ctx.fillStyle = c;
    ctx.fill();
  });

  // Department.
  const deptName = department.trim() || 'Department';
  const sans = (px: number) => `600 ${px}px ${SANS}`;
  const dsize = fitSize(ctx, deptName, sans, tw, 46, 32) ?? 32;
  ctx.font = sans(dsize);
  ctx.fillStyle = s.sub;
  ctx.fillText(ellipsize(ctx, deptName, tw), tx, y + 24 + dsize * 0.9);

  // Head count: one dot per person (up to twelve), then the number in words.
  const count = Math.max(0, Math.floor(people));
  const by = cy + ch - 56;
  const shown = Math.min(count, 12);
  for (let i = 0; i < shown; i++) {
    ctx.beginPath();
    ctx.arc(tx + 11 + i * 28, by - 11, 10, 0, Math.PI * 2);
    ctx.fillStyle = s.accents[i % 3]!;
    ctx.fill();
  }
  if (count === 0) {
    ctx.beginPath();
    ctx.arc(tx + 11, by - 11, 9, 0, Math.PI * 2);
    ctx.strokeStyle = s.muted;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  const dotsW = Math.max(1, shown) * 28;
  ctx.font = `500 30px ${SANS}`;
  ctx.fillStyle = s.muted;
  ctx.fillText(`${count} ${count === 1 ? 'person' : 'people'}`, tx + dotsW + 10, by);

  // A thin wooden frame ties the poster to the slatted wall.
  ctx.strokeStyle = s.slat;
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, BOARD_W - 8, BOARD_H - 8);
  return el;
}

/* ---------------------------------------------------------------- badge */

function starPath(ctx: Ctx, cx: number, cy: number, outer: number) {
  const inner = outer * 0.48;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? inner : outer;
    const t = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(cx + Math.cos(t) * rad, cy + Math.sin(t) * rad);
  }
  ctx.closePath();
}

/**
 * A 768×224 head badge: a compact charcoal capsule, sized to its text and
 * centred on a transparent canvas, with a status dot (a star for the main agent).
 * `subtitle` segments are split on " · "; the first (agent type) is muted and
 * the rest take the accent colour.
 */
export function createAgentBadge(title: string, subtitle: string, accent: string): HTMLCanvasElement {
  const [el, ctx] = canvas(BADGE_W, BADGE_H);
  const titleFont = `600 40px ${SANS}`;
  const subFont = `600 22px ${SANS}`;
  const capH = 112;
  const dotR = 12;
  const padL = 30;
  const textX = padL + dotR * 2 + 20;
  const padR = 36;
  const maxCap = BADGE_W - 24;
  const maxText = maxCap - textX - padR;

  ctx.font = titleFont;
  tracking(ctx, -0.4);
  const t = ellipsize(ctx, title.trim() || 'Agent', maxText);
  const tW = ctx.measureText(t).width;
  ctx.font = subFont;
  tracking(ctx, 0.3);
  const sub = ellipsize(ctx, subtitle.trim(), maxText);
  const sW = ctx.measureText(sub).width;

  const capW = Math.min(maxCap, Math.max(280, textX + Math.max(tW, sW) + padR));
  const x0 = (BADGE_W - capW) / 2;
  const y0 = (BADGE_H - capH) / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 6;
  roundRect(ctx, x0, y0, capW, capH, capH / 2);
  ctx.fillStyle = 'rgba(24, 29, 27, 0.92)';
  ctx.fill();
  ctx.restore();
  roundRect(ctx, x0 + 1.5, y0 + 1.5, capW - 3, capH - 3, capH / 2 - 1.5);
  ctx.strokeStyle = withAlpha(/^#[0-9a-f]{6}$/i.test(accent) ? accent : '#faf5ea', 0.32);
  ctx.lineWidth = 3;
  ctx.stroke();

  // Status mark, vertically centred against the two lines.
  const mx = x0 + padL + dotR;
  const my = BADGE_H / 2;
  const main = subtitle.includes('★');
  ctx.fillStyle = withAlpha(/^#[0-9a-f]{6}$/i.test(accent) ? accent : '#faf5ea', 0.22);
  ctx.beginPath();
  ctx.arc(mx, my, dotR + 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = accent;
  if (main) starPath(ctx, mx, my, dotR + 4);
  else { ctx.beginPath(); ctx.arc(mx, my, dotR, 0, Math.PI * 2); }
  ctx.fill();

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = titleFont;
  tracking(ctx, -0.4);
  ctx.fillStyle = '#faf5ea';
  ctx.fillText(t, x0 + textX, y0 + 53);

  ctx.font = subFont;
  tracking(ctx, 0.3);
  let sx = x0 + textX;
  sub.split(' · ').forEach((part, i, parts) => {
    ctx.fillStyle = i === 0 && !part.includes('★') ? '#c9c0ac' : accent;
    const text = i < parts.length - 1 ? `${part} · ` : part;
    ctx.fillText(text, sx, y0 + 87);
    sx += ctx.measureText(text).width;
  });
  tracking(ctx, 0);
  return el;
}
