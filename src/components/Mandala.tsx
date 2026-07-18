// Deterministic mandala from a seed string. Pure SVG, no deps.

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function Mandala({ seed, size = 320 }: { seed: string; size?: number }) {
  const rand = mulberry32(fnv1a(seed || "center"));
  const cx = size / 2, cy = size / 2;
  const rings = 4 + Math.floor(rand() * 3); // 4-6 rings
  const petals = [6, 8, 12, 16, 24][Math.floor(rand() * 5)];
  const outerR = size * 0.46;
  const hueShift = Math.floor(rand() * 40); // gold->amber range

  const layers: React.ReactNode[] = [];
  for (let r = 1; r <= rings; r++) {
    const radius = (outerR * r) / rings;
    const n = petals + (r % 2 === 0 ? 0 : Math.floor(rand() * petals * 0.5));
    const rot = rand() * 360;
    const pts: string[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (rot * Math.PI) / 180;
      const jitter = 0.85 + rand() * 0.3;
      pts.push(`${cx + Math.cos(a) * radius * jitter},${cy + Math.sin(a) * radius * jitter}`);
    }
    layers.push(
      <polygon key={`p-${r}`} points={pts.join(" ")} fill="none"
        stroke={`hsl(${40 + hueShift}, 70%, ${55 + r * 3}%)`}
        strokeOpacity={0.55 - r * 0.05} strokeWidth={0.8} />
    );
    layers.push(
      <circle key={`c-${r}`} cx={cx} cy={cy} r={radius} fill="none"
        stroke={`hsl(${260 + hueShift}, 40%, 70%)`}
        strokeOpacity={0.15} strokeWidth={0.5} />
    );
    // spokes
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (rot * Math.PI) / 180;
      const x2 = cx + Math.cos(a) * radius;
      const y2 = cy + Math.sin(a) * radius;
      layers.push(
        <line key={`l-${r}-${i}`} x1={cx} y1={cy} x2={x2} y2={y2}
          stroke={`hsl(${40 + hueShift}, 60%, 65%)`} strokeOpacity={0.08} strokeWidth={0.4} />
      );
    }
  }
  // center bindu
  layers.push(<circle key="bindu" cx={cx} cy={cy} r={size * 0.02} fill={`hsl(${40 + hueShift}, 90%, 70%)`} />);
  layers.push(<circle key="bindu-halo" cx={cx} cy={cy} r={size * 0.05} fill="none" stroke={`hsl(${40 + hueShift}, 80%, 65%)`} strokeOpacity={0.5} />);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      className="drop-shadow-[0_0_40px_rgba(217,180,110,0.25)]" role="img" aria-label="Mandala">
      <defs>
        <radialGradient id="mandala-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1a1330" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#050308" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={outerR + 6} fill="url(#mandala-bg)" />
      {layers}
    </svg>
  );
}