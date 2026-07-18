// Client-safe: chaos-magic letter reduction and SVG sigil builder.

export function reduceLetters(statement: string): string {
  const upper = statement.toUpperCase().replace(/[^A-Z]/g, "");
  // Remove vowels, then dedupe consecutive duplicates.
  const consonants = upper.replace(/[AEIOU]/g, "");
  let out = "";
  for (const c of consonants) if (out[out.length - 1] !== c) out += c;
  return out;
}

// Deterministic sigil SVG from reduced letters, arranged on a 24-point circle.
export function buildSigilSvg(reduced: string, size = 480): string {
  const letters = reduced.length ? reduced : "SIGIL";
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.36;
  const N = 24;
  const pt = (i: number) => {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    return [cx + Math.cos(a) * R, cy + Math.sin(a) * R] as const;
  };
  const idx = (ch: string) => (ch.charCodeAt(0) - 65) % N;

  const points = [...letters].map(idx);
  const path = points
    .map(([], i) => {
      const [x, y] = pt(points[i]);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const [x0, y0] = pt(points[0]);
  const [xL, yL] = pt(points[points.length - 1]);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#1a1626"/>
      <stop offset="100%" stop-color="#050308"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <circle cx="${cx}" cy="${cy}" r="${R + 18}" fill="none" stroke="#d4b878" stroke-width="1" opacity="0.6"/>
  <circle cx="${cx}" cy="${cy}" r="${R + 8}" fill="none" stroke="#d4b878" stroke-width="0.5" opacity="0.4"/>
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#d4b878" stroke-width="0.5" opacity="0.3" stroke-dasharray="2 6"/>
  <path d="${path}" fill="none" stroke="#f4e4b8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${x0}" cy="${y0}" r="5" fill="#f4e4b8"/>
  <circle cx="${xL}" cy="${yL}" r="3" fill="none" stroke="#f4e4b8" stroke-width="1.5"/>
</svg>`;
}