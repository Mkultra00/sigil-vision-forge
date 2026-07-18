type Props = { lines: number[]; size?: number };

// lines: 6..9 bottom→top. 7/9 = yang (solid). 6/8 = yin (broken). 6/9 changing.
export function HexagramGlyph({ lines, size = 120 }: Props) {
  const w = size;
  const h = size * 1.15;
  const gap = h / 9;
  const lineH = gap * 0.55;
  const marginX = w * 0.15;
  const innerW = w - marginX * 2;
  const gapMid = innerW * 0.18;
  const halfW = (innerW - gapMid) / 2;

  // Render top→bottom in SVG y, but line[5] is the top line of the hexagram.
  const rows = [5, 4, 3, 2, 1, 0];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="block">
      {rows.map((idx, row) => {
        const v = lines[idx];
        const y = gap * (row + 1.5);
        const yang = v === 7 || v === 9;
        const changing = v === 6 || v === 9;
        return (
          <g key={idx}>
            {yang ? (
              <rect
                x={marginX}
                y={y - lineH / 2}
                width={innerW}
                height={lineH}
                rx={lineH / 3}
                fill="#f4e4b8"
              />
            ) : (
              <>
                <rect
                  x={marginX}
                  y={y - lineH / 2}
                  width={halfW}
                  height={lineH}
                  rx={lineH / 3}
                  fill="#f4e4b8"
                />
                <rect
                  x={marginX + halfW + gapMid}
                  y={y - lineH / 2}
                  width={halfW}
                  height={lineH}
                  rx={lineH / 3}
                  fill="#f4e4b8"
                />
              </>
            )}
            {changing && (
              <circle
                cx={w - marginX * 0.4}
                cy={y}
                r={lineH * 0.5}
                fill="none"
                stroke="#fca5a5"
                strokeWidth={1.4}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}