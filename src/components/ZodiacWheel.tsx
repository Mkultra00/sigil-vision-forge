import { ZODIAC_META } from "@/lib/astrology.functions";

export function ZodiacWheel({
  natal,
  transitSun,
  transitMoon,
  size = 340,
}: {
  natal?: string | null;
  transitSun: string;
  transitMoon?: string;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2 - 4;
  const inner = outer * 0.78;
  const glyphR = (outer + inner) / 2;
  const step = 360 / 12;

  const angleFor = (name: string) => {
    const i = ZODIAC_META.findIndex((z) => z.name === name);
    if (i < 0) return 0;
    // 9 o'clock = Aries 0°, going counter-clockwise (astrology convention).
    return 180 - (i * step + step / 2);
  };

  const point = (angleDeg: number, r: number) => {
    const a = (angleDeg * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const;
  };

  const elementColor: Record<string, string> = {
    fire: "#f59e0b",
    earth: "#84cc16",
    air: "#38bdf8",
    water: "#a78bfa",
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-[0_0_30px_rgba(251,191,36,0.15)]">
      <defs>
        <radialGradient id="wheelBg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1a1330" />
          <stop offset="100%" stopColor="#050308" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={outer} fill="url(#wheelBg)" stroke="rgba(251,191,36,0.35)" />
      <circle cx={cx} cy={cy} r={inner} fill="none" stroke="rgba(251,191,36,0.2)" />

      {ZODIAC_META.map((sign, i) => {
        const a1 = 180 - i * step;
        const a2 = 180 - (i + 1) * step;
        const [x1, y1] = point(a1, inner);
        const [x2, y2] = point(a1, outer);
        const glyphA = 180 - (i * step + step / 2);
        const [gx, gy] = point(glyphA, glyphR);
        const col = elementColor[sign.element] ?? "#fbbf24";
        return (
          <g key={sign.name}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(251,191,36,0.25)" />
            <text x={gx} y={gy} textAnchor="middle" dominantBaseline="central"
              fontSize={size * 0.05} fill={col} opacity={0.85}>
              {sign.glyph}
            </text>
            {(() => {
              const [lx, ly] = point(glyphA, inner * 0.72);
              return (
                <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
                  fontSize={size * 0.022} fill="rgba(231,229,228,0.4)" letterSpacing="1">
                  {sign.name.slice(0, 3).toUpperCase()}
                </text>
              );
            })()}
          </g>
        );
      })}

      {/* Natal sun marker */}
      {natal && (() => {
        const [px, py] = point(angleFor(natal), inner * 0.5);
        return (
          <g>
            <circle cx={px} cy={py} r={size * 0.028} fill="#fbbf24" opacity="0.85" />
            <circle cx={px} cy={py} r={size * 0.045} fill="none" stroke="#fbbf24" opacity="0.4" />
            <text x={px} y={py + size * 0.075} textAnchor="middle" fontSize={size * 0.024}
              fill="#fbbf24" opacity={0.9}>natal ☉</text>
          </g>
        );
      })()}

      {/* Transit sun marker */}
      {(() => {
        const [px, py] = point(angleFor(transitSun), inner * 0.32);
        return (
          <g>
            <circle cx={px} cy={py} r={size * 0.024} fill="#f97316" opacity="0.9" />
            <text x={px} y={py + size * 0.06} textAnchor="middle" fontSize={size * 0.022}
              fill="#fb923c" opacity={0.9}>transit ☉</text>
          </g>
        );
      })()}

      {/* Transit moon marker */}
      {transitMoon && (() => {
        const [px, py] = point(angleFor(transitMoon), inner * 0.16);
        return (
          <g>
            <circle cx={px} cy={py} r={size * 0.02} fill="#e0e7ff" opacity="0.85" />
            <text x={px} y={py + size * 0.055} textAnchor="middle" fontSize={size * 0.02}
              fill="#c7d2fe" opacity={0.85}>☾</text>
          </g>
        );
      })()}
    </svg>
  );
}