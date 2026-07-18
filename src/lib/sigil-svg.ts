// Client-safe: chaos-magic letter reduction and SVG sigil builder.

export function reduceLetters(statement: string): string {
  const upper = statement.toUpperCase().replace(/[^A-Z]/g, "");
  // Remove vowels, then dedupe consecutive duplicates.
  const consonants = upper.replace(/[AEIOU]/g, "");
  let out = "";
  for (const c of consonants) if (out[out.length - 1] !== c) out += c;
  return out;
}

// FNV-1a — deterministic per-statement seed.
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32 PRNG.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic-but-varied sigil. Geometry, rotation, curvature and vertex
// glyphs are all seeded by the reduced statement, so no two intents look alike.
export function buildSigilSvg(reduced: string, size = 480): string {
  const letters = reduced.length ? reduced : "SIGIL";
  const seed = hash32(letters);
  const rand = rng(seed);

  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.34;

  // Number of points on the outer circle varies (17–29), so mapping shifts.
  const N = 17 + (seed % 13);
  const rot = rand() * Math.PI * 2;
  const pt = (i: number) => {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2 + rot;
    return [cx + Math.cos(a) * R, cy + Math.sin(a) * R] as const;
  };
  const idx = (ch: string) => (ch.charCodeAt(0) - 65 + ((seed >> 3) & 0xff)) % N;

  const points = [...letters].map(idx);

  // Curved path: quadratic Bezier between consecutive vertices, with control
  // point pulled toward or away from the center by a seeded amount.
  const curve = 0.15 + rand() * 0.55; // 0.15..0.7 — from taut to loopy
  const inward = rand() < 0.5 ? -1 : 1;
  let path = "";
  for (let i = 0; i < points.length; i++) {
    const [x, y] = pt(points[i]);
    if (i === 0) { path += `M ${x.toFixed(1)} ${y.toFixed(1)} `; continue; }
    const [px, py] = pt(points[i - 1]);
    const mx = (px + x) / 2;
    const my = (py + y) / 2;
    // Perpendicular offset from midpoint toward/away from center.
    const dx = cx - mx;
    const dy = cy - my;
    const cxp = mx + dx * curve * inward;
    const cyp = my + dy * curve * inward;
    path += `Q ${cxp.toFixed(1)} ${cyp.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)} `;
  }

  const [x0, y0] = pt(points[0]);
  const [xL, yL] = pt(points[points.length - 1]);

  // Vertex glyphs — a small mark chosen per letter.
  const glyphs = points.map((p, i) => {
    const [x, y] = pt(p);
    const kind = (letters.charCodeAt(i) + seed) % 4;
    if (kind === 0) return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="#f4e4b8"/>`;
    if (kind === 1) return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="none" stroke="#f4e4b8" stroke-width="1"/>`;
    if (kind === 2) return `<path d="M ${(x-4).toFixed(1)} ${y.toFixed(1)} L ${(x+4).toFixed(1)} ${y.toFixed(1)} M ${x.toFixed(1)} ${(y-4).toFixed(1)} L ${x.toFixed(1)} ${(y+4).toFixed(1)}" stroke="#f4e4b8" stroke-width="1"/>`;
    return `<path d="M ${(x-3).toFixed(1)} ${(y-3).toFixed(1)} L ${(x+3).toFixed(1)} ${(y+3).toFixed(1)} M ${(x+3).toFixed(1)} ${(y-3).toFixed(1)} L ${(x-3).toFixed(1)} ${(y+3).toFixed(1)}" stroke="#f4e4b8" stroke-width="1"/>`;
  }).join("\n  ");

  // Inner ornament: a star polygon whose skip varies by seed.
  const inner: string[] = [];
  const M = 5 + (seed % 4); // 5..8 vertices
  const skip = 2 + (seed % Math.max(1, Math.floor(M / 2)));
  const rInner = R * (0.35 + rand() * 0.25);
  const rotInner = rand() * Math.PI * 2;
  for (let i = 0; i < M; i++) {
    const a1 = (i / M) * Math.PI * 2 + rotInner;
    const a2 = ((i + skip) / M) * Math.PI * 2 + rotInner;
    inner.push(
      `<line x1="${(cx + Math.cos(a1) * rInner).toFixed(1)}" y1="${(cy + Math.sin(a1) * rInner).toFixed(1)}" x2="${(cx + Math.cos(a2) * rInner).toFixed(1)}" y2="${(cy + Math.sin(a2) * rInner).toFixed(1)}" stroke="#d4b878" stroke-width="0.6" opacity="0.55"/>`,
    );
  }

  // Cardinal tick marks around outer ring — count varies.
  const ticks: string[] = [];
  const T = 8 + (seed % 8); // 8..15
  for (let i = 0; i < T; i++) {
    const a = (i / T) * Math.PI * 2 + rot;
    const r1 = R + 14;
    const r2 = R + 22;
    ticks.push(
      `<line x1="${(cx + Math.cos(a) * r1).toFixed(1)}" y1="${(cy + Math.sin(a) * r1).toFixed(1)}" x2="${(cx + Math.cos(a) * r2).toFixed(1)}" y2="${(cy + Math.sin(a) * r2).toFixed(1)}" stroke="#d4b878" stroke-width="0.8" opacity="0.7"/>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <radialGradient id="bg-${seed}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#1a1626"/>
      <stop offset="100%" stop-color="#050308"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg-${seed})"/>
  <circle cx="${cx}" cy="${cy}" r="${R + 26}" fill="none" stroke="#d4b878" stroke-width="1" opacity="0.6"/>
  <circle cx="${cx}" cy="${cy}" r="${R + 12}" fill="none" stroke="#d4b878" stroke-width="0.5" opacity="0.35"/>
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#d4b878" stroke-width="0.5" opacity="0.3" stroke-dasharray="2 6"/>
  ${ticks.join("\n  ")}
  ${inner.join("\n  ")}
  <path d="${path}" fill="none" stroke="#f4e4b8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  ${glyphs}
  <circle cx="${x0.toFixed(1)}" cy="${y0.toFixed(1)}" r="5.5" fill="#f4e4b8"/>
  <circle cx="${xL.toFixed(1)}" cy="${yL.toFixed(1)}" r="4" fill="none" stroke="#f4e4b8" stroke-width="1.5"/>
</svg>`;
}