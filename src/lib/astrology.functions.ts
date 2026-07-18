import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  birthdate: z.string().max(32).optional(),
  timeframe: z.enum(["today", "week", "month", "quarter", "year"]),
  question: z.string().max(500).optional(),
});

const ZODIAC = [
  { name: "Aries",       glyph: "♈", element: "fire",  modality: "cardinal", ruler: "Mars",    start: [3, 21], end: [4, 19] },
  { name: "Taurus",      glyph: "♉", element: "earth", modality: "fixed",    ruler: "Venus",   start: [4, 20], end: [5, 20] },
  { name: "Gemini",      glyph: "♊", element: "air",   modality: "mutable",  ruler: "Mercury", start: [5, 21], end: [6, 20] },
  { name: "Cancer",      glyph: "♋", element: "water", modality: "cardinal", ruler: "Moon",    start: [6, 21], end: [7, 22] },
  { name: "Leo",         glyph: "♌", element: "fire",  modality: "fixed",    ruler: "Sun",     start: [7, 23], end: [8, 22] },
  { name: "Virgo",       glyph: "♍", element: "earth", modality: "mutable",  ruler: "Mercury", start: [8, 23], end: [9, 22] },
  { name: "Libra",       glyph: "♎", element: "air",   modality: "cardinal", ruler: "Venus",   start: [9, 23], end: [10, 22] },
  { name: "Scorpio",     glyph: "♏", element: "water", modality: "fixed",    ruler: "Pluto",   start: [10, 23], end: [11, 21] },
  { name: "Sagittarius", glyph: "♐", element: "fire",  modality: "mutable",  ruler: "Jupiter", start: [11, 22], end: [12, 21] },
  { name: "Capricorn",   glyph: "♑", element: "earth", modality: "cardinal", ruler: "Saturn",  start: [12, 22], end: [1, 19] },
  { name: "Aquarius",    glyph: "♒", element: "air",   modality: "fixed",    ruler: "Uranus",  start: [1, 20], end: [2, 18] },
  { name: "Pisces",      glyph: "♓", element: "water", modality: "mutable",  ruler: "Neptune", start: [2, 19], end: [3, 20] },
] as const;

function sunSignFor(month: number, day: number) {
  for (const s of ZODIAC) {
    const [sm, sd] = s.start;
    const [em, ed] = s.end;
    if (sm === em) {
      if (month === sm && day >= sd && day <= ed) return s;
    } else {
      if ((month === sm && day >= sd) || (month === em && day <= ed)) return s;
    }
  }
  return ZODIAC[0];
}

// Cheap approximation of Moon sign — average lunar cycle ~27.3 days across the
// zodiac. Not an ephemeris; just a symbolic anchor for the reading.
function approxMoonSign(date: Date) {
  const ref = Date.UTC(2000, 0, 6, 18, 14); // near a known Aries moon reference
  const days = (date.getTime() - ref) / 86400000;
  const idx = Math.floor(((days / 2.2751) % 12 + 12) % 12);
  return ZODIAC[idx];
}

const TIMEFRAME_LABEL: Record<z.infer<typeof Input>["timeframe"], string> = {
  today: "today",
  week: "the coming week",
  month: "the coming month",
  quarter: "the coming three months",
  year: "the coming year",
};

export const castHoroscope = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const now = new Date();
    const transitSun = sunSignFor(now.getUTCMonth() + 1, now.getUTCDate());
    const transitMoon = approxMoonSign(now);

    let natalSun: typeof ZODIAC[number] | null = null;
    if (data.birthdate) {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(data.birthdate);
      if (m) natalSun = sunSignFor(parseInt(m[2], 10), parseInt(m[3], 10));
    }

    const themes: Array<{ key: string; label: string }> = [
      { key: "overview", label: "The Sky Overall" },
      { key: "love", label: "Love & Bonds" },
      { key: "work", label: "Work & Craft" },
      { key: "inner", label: "Inner Weather" },
      { key: "warning", label: "Where to Tread Softly" },
      { key: "omen", label: "A Small Omen" },
    ];

    const system = `You are a soft-spoken Western astrologer. Write in second person, present tense, warm, poetic yet concrete. No disclaimers. No bullet lists. Each section is 2-3 sentences. Return STRICT JSON only.`;

    const natalBlock = natalSun
      ? `Seeker's Sun sign (natal): ${natalSun.name} (${natalSun.element}, ${natalSun.modality}, ruled by ${natalSun.ruler}).`
      : `Seeker's birthdate is unknown — speak from the transit sky only.`;

    const user = `${natalBlock}
Current transit Sun: ${transitSun.name} (${transitSun.element}, ${transitSun.modality}).
Approximate transit Moon: ${transitMoon.name} (${transitMoon.element}).
Today's date: ${now.toISOString().slice(0, 10)}.
Timeframe of the reading: ${TIMEFRAME_LABEL[data.timeframe]}.
Seeker's question: ${data.question || "(unspoken)"}.

Return JSON with this exact shape:
{
  "headline": "<a single evocative sentence framing ${TIMEFRAME_LABEL[data.timeframe]}>",
  "sections": [
    ${themes.map((t) => `{ "key": "${t.key}", "label": "${t.label}", "text": "<2-3 sentences>" }`).join(",\n    ")}
  ],
  "synthesis": "<one short paragraph, 3-5 sentences, weaving natal Sun, transit Sun, and Moon into a single reading tuned to the timeframe and question>"
}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`horoscope failed: ${res.status} ${await res.text().catch(() => "")}`);
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { headline?: string; sections?: Array<{ key: string; label: string; text: string }>; synthesis?: string } = {};
    try { parsed = JSON.parse(content); } catch { /* noop */ }

    return {
      timeframe: data.timeframe,
      timeframe_label: TIMEFRAME_LABEL[data.timeframe],
      date: now.toISOString(),
      natal_sun: natalSun ? { name: natalSun.name, glyph: natalSun.glyph, element: natalSun.element, modality: natalSun.modality, ruler: natalSun.ruler } : null,
      transit_sun: { name: transitSun.name, glyph: transitSun.glyph, element: transitSun.element, modality: transitSun.modality },
      transit_moon: { name: transitMoon.name, glyph: transitMoon.glyph, element: transitMoon.element },
      headline: parsed.headline ?? "",
      sections: parsed.sections ?? [],
      synthesis: parsed.synthesis ?? "",
    };
  });

export type Horoscope = Awaited<ReturnType<typeof castHoroscope>>;

export const ZODIAC_META = ZODIAC.map((s) => ({ name: s.name, glyph: s.glyph, element: s.element }));