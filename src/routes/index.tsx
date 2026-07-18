import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { castReading } from "@/lib/divination.functions";
import { castHoroscope, type Horoscope } from "@/lib/astrology.functions";
import { generateSigil } from "@/lib/sigil.functions";
import { generateVision } from "@/lib/vision.functions";
import { interpretReading } from "@/lib/interpret.functions";
import { VoiceAgent, type VoiceApi } from "@/components/VoiceAgent";
import { tarotImageUrl } from "@/lib/tarot-images";
import { HexagramGlyph } from "@/components/HexagramGlyph";
import { ZodiacWheel } from "@/components/ZodiacWheel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shaman — Voice-first divination" },
      { name: "description", content: "A quiet ritual space for tarot, I Ching, sigils, and visions." },
      { property: "og:title", content: "Shaman — Voice-first divination" },
      { property: "og:description", content: "A quiet ritual space for tarot, I Ching, sigils, and visions." },
    ],
  }),
  component: Ritual,
});

type Drawn = {
  position: number;
  label: string;
  hint: string;
  code: string;
  name: string;
  keywords: string[];
  text: string;
  reversed: boolean;
  changing?: number[];
  lines?: number[];
};

type PastReading = {
  id: string;
  question: string;
  system: "tarot" | "iching";
  spread: string;
  drawn: Drawn[];
  synthesis?: string;
  positions?: Array<{ position: number; significance: string }>;
  at: number;
};

const HISTORY_KEY = "shaman.history.v1";
const HISTORY_MAX = 8;

function useAnonSession() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        await supabase.auth.signInAnonymously();
      }
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
  }, []);
  return ready;
}

const SPREADS = [
  { system: "tarot" as const, slug: "three_card", name: "Three Card — Past · Present · Future" },
  { system: "iching" as const, slug: "hexagram_6line", name: "I Ching — Six Lines" },
  { system: "astrology" as const, slug: "horoscope", name: "Western Horoscope" },
];

const TIMEFRAMES = [
  { value: "today" as const, label: "Today" },
  { value: "week" as const, label: "This week" },
  { value: "month" as const, label: "This month" },
  { value: "quarter" as const, label: "3 months" },
  { value: "year" as const, label: "This year" },
];

function Ritual() {
  const ready = useAnonSession();
  const cast = useServerFn(castReading);
  const horoscopeFn = useServerFn(castHoroscope);
  const sigilFn = useServerFn(generateSigil);
  const visionFn = useServerFn(generateVision);
  const interpretFn = useServerFn(interpretReading);

  const [question, setQuestion] = useState("");
  const [spreadIdx, setSpreadIdx] = useState(0);
  const [timeframe, setTimeframe] = useState<typeof TIMEFRAMES[number]["value"]>("today");
  const [horoscope, setHoroscope] = useState<Horoscope | null>(null);
  const [horoBusy, setHoroBusy] = useState(false);
  const [birthdate, setBirthdate] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try { return window.localStorage.getItem("shaman.birthdate.v1") ?? ""; } catch { return ""; }
  });
  useEffect(() => {
    try { window.localStorage.setItem("shaman.birthdate.v1", birthdate); } catch { /* noop */ }
  }, [birthdate]);
  const [drawing, setDrawing] = useState(false);
  const [reading, setReading] = useState<{ id: string; spread: string; drawn: Drawn[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [interpretBusy, setInterpretBusy] = useState(false);
  const [interpretation, setInterpretation] = useState<{
    positions: Array<{ position: number; significance: string }>;
    synthesis: string;
  } | null>(null);

  const [intent, setIntent] = useState("");
  const [sigilBusy, setSigilBusy] = useState(false);
  const [sigil, setSigil] = useState<{ svg: string; image_url: string | null; statement: string; reduced: string } | null>(null);

  const [visionBusy, setVisionBusy] = useState(false);
  const [vision, setVision] = useState<{ image_url: string | null; prompt: string } | null>(null);

  const voiceRef = useRef<VoiceApi | null>(null);
  const [speakBusy, setSpeakBusy] = useState<string | null>(null);
  const speak = useCallback(async (label: string, text: string) => {
    if (!text.trim() || !voiceRef.current) return;
    setSpeakBusy(label);
    try { await voiceRef.current.speak(`Please speak this aloud to the seeker, in your voice: "${text}"`); }
    finally { setSpeakBusy(null); }
  }, []);

  const [history, setHistory] = useState<PastReading[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      return raw ? (JSON.parse(raw) as PastReading[]) : [];
    } catch { return []; }
  });
  useEffect(() => {
    try { window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch { /* noop */ }
  }, [history]);

  // When an interpretation lands for the current reading, fold it into history.
  useEffect(() => {
    if (!reading || !interpretation) return;
    const sys = SPREADS[spreadIdx].system;
    if (sys === "astrology") return;
    setHistory((prev) => {
      const withoutCurrent = prev.filter((h) => h.id !== reading.id);
      const entry: PastReading = {
        id: reading.id,
        question,
        system: sys,
        spread: reading.spread,
        drawn: reading.drawn,
        synthesis: interpretation.synthesis,
        positions: interpretation.positions,
        at: Date.now(),
      };
      return [...withoutCurrent, entry].slice(-HISTORY_MAX);
    });
  }, [reading, interpretation, question, spreadIdx]);

  async function onDraw() {
    setErr(null); setDrawing(true); setReading(null); setVision(null); setInterpretation(null); setHoroscope(null);
    try {
      const s = SPREADS[spreadIdx];
      if (s.system === "astrology") {
        setHoroBusy(true);
        try {
          const h = await horoscopeFn({ data: { birthdate: birthdate || undefined, timeframe, question: question || undefined } });
          setHoroscope(h);
        } finally { setHoroBusy(false); }
        return;
      }
      const r = await cast({ data: { system: s.system, spread_slug: s.slug, question: question || undefined } });
      setReading({ id: r.reading_id, spread: r.spread_name, drawn: r.drawn as Drawn[] });
      // Kick off interpretation in the background.
      setInterpretBusy(true);
      const priorForLLM = history.filter((h) => h.id !== r.reading_id).map((h) => ({
        question: h.question || undefined,
        system: h.system,
        spread: h.spread,
        drawn: h.drawn.map((d) => ({
          label: d.label, name: d.name, reversed: d.reversed, keywords: d.keywords,
        })),
        synthesis: h.synthesis,
      }));
      interpretFn({ data: { reading_id: r.reading_id, history: priorForLLM, birthdate: birthdate || undefined } })
        .then((res) => setInterpretation(res))
        .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
        .finally(() => setInterpretBusy(false));
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setDrawing(false); }
  }

  async function onSigil() {
    if (!intent.trim()) return;
    setSigilBusy(true); setErr(null);
    try {
      const r = await sigilFn({ data: { intent, ornament: true } });
      setSigil({ svg: r.svg, image_url: r.image_url, statement: r.statement, reduced: r.reduced });
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSigilBusy(false); }
  }

  async function onVision() {
    if (!reading) return;
    setVisionBusy(true); setErr(null);
    try {
      const r = await visionFn({ data: { reading_id: reading.id } });
      setVision({ image_url: r.image_url, prompt: r.prompt });
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setVisionBusy(false); }
  }

  return (
    <div className="min-h-screen text-stone-100" style={{
      background: "radial-gradient(ellipse at top, #1a1330 0%, #0a0612 55%, #050308 100%)",
    }}>
      <div className="mx-auto max-w-5xl px-6 py-16">
        <header className="text-center mb-12">
          <div className="text-xs tracking-[0.4em] text-amber-200/60 uppercase">Shaman</div>
          <h1 className="mt-3 text-4xl md:text-5xl font-serif text-amber-50">A Quiet Ritual</h1>
          <p className="mt-4 text-stone-300/80 max-w-xl mx-auto text-sm leading-relaxed">
            Ask a question. Draw the symbols. Watch them speak. Turn intent into a sigil.
            End with a vision.
          </p>
        </header>

        {!ready && <p className="text-center text-stone-400">Lighting the candle…</p>}
        {err && <p className="text-center text-rose-300/90 mb-6 text-sm">{err}</p>}

        {ready && (
          <section className="rounded-2xl border border-amber-100/10 bg-black/30 backdrop-blur p-6 md:p-8">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <label className="text-[10px] tracking-[0.25em] uppercase text-amber-200/60">Birthdate (optional)</label>
              <input
                type="date"
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
                className="bg-transparent border-b border-amber-100/20 focus:border-amber-200/60 outline-none py-1 text-sm text-amber-50 [color-scheme:dark]"
              />
              {birthdate && (
                <button
                  onClick={() => setBirthdate("")}
                  className="text-[10px] tracking-widest uppercase text-stone-500 hover:text-rose-300/80"
                >
                  clear
                </button>
              )}
            </div>
            <label className="block text-xs tracking-widest uppercase text-amber-200/70 mb-2">Your question</label>
            <textarea
              value={question} onChange={(e) => setQuestion(e.target.value)}
              placeholder="What lies beneath the surface of…"
              rows={2}
              className="w-full bg-transparent border-b border-amber-100/20 focus:border-amber-200/60 outline-none py-2 text-lg text-amber-50 placeholder:text-stone-500 font-serif"
            />
            <div className="mt-6 flex flex-wrap gap-2">
              {SPREADS.map((s, i) => (
                <button key={s.slug} onClick={() => setSpreadIdx(i)}
                  className={`px-4 py-2 rounded-full text-xs tracking-wide border transition ${
                    spreadIdx === i
                      ? "border-amber-200/70 bg-amber-100/10 text-amber-100"
                      : "border-stone-600/40 text-stone-400 hover:border-amber-200/40"
                  }`}>{s.name}</button>
              ))}
            </div>
            <div className="mt-6">
              <button onClick={onDraw} disabled={drawing}
                className="px-6 py-3 rounded-full bg-amber-100/90 text-stone-900 text-sm font-medium tracking-wide hover:bg-amber-50 disabled:opacity-50">
                {drawing ? "Drawing…" : "Draw"}
              </button>
            </div>
          </section>
        )}

        {reading && (
          <section className="mt-10">
            <h2 className="text-xs tracking-[0.3em] uppercase text-amber-200/60 text-center mb-6">{reading.spread}</h2>
            {SPREADS[spreadIdx].slug === "celtic_cross" && (
              <CelticCrossBoard drawn={reading.drawn} />
            )}
            {SPREADS[spreadIdx].system === "iching" && (
              <IChingBoard drawn={reading.drawn} />
            )}
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {reading.drawn.map((d) => (
                <SymbolCard
                  key={`${d.position}-${d.code}`}
                  d={d}
                  significance={interpretation?.positions.find((p) => p.position === d.position)?.significance}
                  loading={interpretBusy && !interpretation}
                  onSpeak={(txt) => speak(`pos-${d.position}`, txt)}
                  speaking={speakBusy === `pos-${d.position}`}
                />
              ))}
            </div>
            {(interpretBusy || interpretation?.synthesis) && (
              <div className="mt-8 rounded-xl border border-amber-100/10 bg-black/40 p-6 max-w-3xl mx-auto">
                <div className="text-[10px] tracking-[0.3em] uppercase text-amber-200/60 mb-2">Synthesis</div>
                {interpretation?.synthesis ? (
                  <>
                    <p className="text-stone-200 font-serif leading-relaxed italic">{interpretation.synthesis}</p>
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => speak("synthesis", interpretation.synthesis)}
                        disabled={speakBusy === "synthesis"}
                        className="text-[10px] tracking-[0.25em] uppercase text-amber-200/80 border border-amber-200/30 rounded-full px-3 py-1 hover:bg-amber-100/5 disabled:opacity-50"
                      >
                        {speakBusy === "synthesis" ? "Speaking…" : "Hear it spoken"}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-stone-500 text-sm italic">The threads are being drawn together…</p>
                )}
              </div>
            )}
            <div className="mt-8 text-center">
              <button onClick={onVision} disabled={visionBusy}
                className="px-5 py-2 rounded-full border border-amber-200/40 text-amber-100 text-xs tracking-widest uppercase hover:bg-amber-100/5 disabled:opacity-50">
                {visionBusy ? "The vision is forming…" : "Summon a vision"}
              </button>
            </div>
            {vision?.image_url && (
              <div className="mt-8 flex flex-col items-center">
                <img src={vision.image_url} alt="Vision"
                  className="rounded-lg max-w-md border border-amber-100/20 shadow-2xl" />
                <p className="mt-3 text-xs text-stone-400 max-w-md text-center italic">{vision.prompt}</p>
              </div>
            )}
          </section>
        )}

        <section className="mt-16 rounded-2xl border border-amber-100/10 bg-black/30 backdrop-blur p-6 md:p-8">
          <div className="text-xs tracking-[0.3em] uppercase text-amber-200/60 mb-3">Sigil</div>
          <p className="text-sm text-stone-400 mb-4">
            Write a statement of will. The vowels are burned away, the letters bound to a
            geometric line, then adorned by the current.
          </p>
          <div className="flex gap-3 items-start">
            <input value={intent} onChange={(e) => setIntent(e.target.value)}
              placeholder="to move with courage"
              className="flex-1 bg-transparent border-b border-amber-100/20 focus:border-amber-200/60 outline-none py-2 text-amber-50 placeholder:text-stone-500 font-serif" />
            <button onClick={onSigil} disabled={sigilBusy || !intent.trim()}
              className="px-5 py-2 rounded-full bg-amber-100/90 text-stone-900 text-sm hover:bg-amber-50 disabled:opacity-50">
              {sigilBusy ? "Binding…" : "Bind"}
            </button>
          </div>
          {sigil && (
            <div className="mt-6 grid gap-6 md:grid-cols-2 items-center">
              <div className="flex justify-center">
                {sigil.image_url ? (
                  <img src={sigil.image_url} alt="Sigil" className="rounded-lg max-w-xs border border-amber-100/20" />
                ) : (
                  <div className="rounded-lg border border-amber-100/20 p-2 bg-black/40"
                    dangerouslySetInnerHTML={{ __html: sigil.svg }} />
                )}
              </div>
              <div className="text-sm text-stone-300">
                <div className="text-xs tracking-widest uppercase text-amber-200/60 mb-1">Statement</div>
                <p className="font-serif italic text-amber-50/90">{sigil.statement}</p>
                <div className="mt-4 text-xs tracking-widest uppercase text-amber-200/60 mb-1">Reduced letters</div>
                <p className="font-mono tracking-widest text-amber-100/80">{sigil.reduced}</p>
              </div>
            </div>
          )}
        </section>

        {ready && (
          <VoiceAgent
            onReady={(api) => { voiceRef.current = api; }}
            context={
              reading
                ? {
                    question,
                    birthdate: birthdate || undefined,
                    system: SPREADS[spreadIdx].system,
                    spread: reading.spread,
                    drawn: reading.drawn.map((d) => ({
                      label: d.label,
                      hint: d.hint,
                      name: d.name,
                      reversed: d.reversed,
                      keywords: d.keywords,
                      text: d.text,
                      changing: d.changing,
                    })),
                    positions: interpretation?.positions,
                    synthesis: interpretation?.synthesis,
                    sigil: sigil ? { statement: sigil.statement, reduced: sigil.reduced, has_image: !!sigil.image_url } : null,
                    pending_intent: intent && (!sigil || sigil.statement !== intent) ? intent : undefined,
                    vision: vision ? { prompt: vision.prompt, has_image: !!vision.image_url } : null,
                    history: history
                      .filter((h) => h.id !== reading.id)
                      .map((h) => ({
                        question: h.question,
                        spread: h.spread,
                        system: h.system,
                        drawn: h.drawn.map((d) => ({ label: d.label, name: d.name, reversed: d.reversed })),
                        synthesis: h.synthesis,
                      })),
                  }
                : {
                    question: question || undefined,
                    birthdate: birthdate || undefined,
                    system: SPREADS[spreadIdx].system,
                    pending_spread: SPREADS[spreadIdx].name,
                    sigil: sigil ? { statement: sigil.statement, reduced: sigil.reduced, has_image: !!sigil.image_url } : null,
                    pending_intent: intent && (!sigil || sigil.statement !== intent) ? intent : undefined,
                    vision: vision ? { prompt: vision.prompt, has_image: !!vision.image_url } : null,
                    history: history.map((h) => ({
                      question: h.question,
                      spread: h.spread,
                      system: h.system,
                      drawn: h.drawn.map((d) => ({ label: d.label, name: d.name, reversed: d.reversed })),
                      synthesis: h.synthesis,
                    })),
                  }
            }
          />
        )}

        {history.length > 0 && (
          <section className="mt-16 rounded-2xl border border-amber-100/10 bg-black/20 backdrop-blur p-6 md:p-8">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs tracking-[0.3em] uppercase text-amber-200/60">The arc so far</div>
              <button
                onClick={() => { setHistory([]); }}
                className="text-[10px] tracking-widest uppercase text-stone-500 hover:text-rose-300/80"
              >
                clear
              </button>
            </div>
            <ol className="space-y-4">
              {history.slice().reverse().map((h, idx) => (
                <li key={h.id} className="border-l border-amber-200/20 pl-4">
                  <div className="text-[10px] tracking-widest uppercase text-amber-200/50">
                    {history.length - idx}. {h.system} · {h.spread}
                  </div>
                  <div className="text-sm text-amber-50/90 font-serif italic mt-1">
                    {h.question || "(unspoken)"}
                  </div>
                  <div className="mt-1 text-xs text-stone-400">
                    {h.drawn.map((d) => `${d.name}${d.reversed ? " ↺" : ""}`).join(" · ")}
                  </div>
                  {h.synthesis && (
                    <p className="mt-2 text-xs text-stone-300/80 leading-relaxed">{h.synthesis}</p>
                  )}
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[11px] text-stone-500 italic">
              Each new draw is read against these. Clear to begin a fresh arc.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

function SymbolCard({ d, significance, loading, onSpeak, speaking }: { d: Drawn; significance?: string; loading?: boolean; onSpeak?: (text: string) => void; speaking?: boolean }) {
  const img = tarotImageUrl(d.code);
  return (
    <div className="rounded-xl border border-amber-100/10 bg-gradient-to-b from-stone-900/60 to-black/60 p-5">
      <div className="text-[10px] tracking-[0.3em] uppercase text-amber-200/60">{d.label}</div>
      <div className="mt-1 text-xs text-stone-500 italic">{d.hint}</div>
      {img && (
        <div className="mt-4 flex justify-center">
          <div className="relative rounded-md overflow-hidden border border-amber-200/20 shadow-[0_10px_40px_-15px_rgba(251,191,36,0.35)] bg-black/40" style={{ width: 160, aspectRatio: "0.58" }}>
            <img
              src={img}
              alt={d.name}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-700"
              style={{ transform: d.reversed ? "rotate(180deg)" : "none" }}
            />
          </div>
        </div>
      )}
      {d.lines?.length === 6 && (
        <div className="mt-4 flex justify-center">
          <HexagramGlyph lines={d.lines} size={110} />
        </div>
      )}
      <div className="mt-4 font-serif text-2xl text-amber-50">
        {d.name}{d.reversed && <span className="text-xs align-super text-rose-300/70 ml-1">reversed</span>}
      </div>
      {!!d.keywords?.length && (
        <div className="mt-2 flex flex-wrap gap-1">
          {d.keywords.slice(0, 4).map((k) => (
            <span key={k} className="text-[10px] uppercase tracking-wider text-amber-200/70 border border-amber-200/20 rounded-full px-2 py-0.5">{k}</span>
          ))}
        </div>
      )}
      <p className="mt-3 text-sm text-stone-300 leading-relaxed">{d.text}</p>
      {d.changing?.length ? (
        <div className="mt-3 text-xs text-amber-200/70">Changing lines: {d.changing.map((n) => n + 1).join(", ")}</div>
      ) : null}
      <div className="mt-4 pt-4 border-t border-amber-100/10">
        <div className="text-[10px] tracking-[0.3em] uppercase text-amber-200/60 mb-1">Significance</div>
        {significance ? (
          <>
            <p className="text-sm text-amber-50/90 font-serif italic leading-relaxed">{significance}</p>
            {onSpeak && (
              <button
                onClick={() => onSpeak(significance)}
                disabled={speaking}
                className="mt-3 text-[10px] tracking-[0.25em] uppercase text-amber-200/70 border border-amber-200/25 rounded-full px-3 py-1 hover:bg-amber-100/5 disabled:opacity-50"
              >
                {speaking ? "Speaking…" : "Hear it spoken"}
              </button>
            )}
          </>
        ) : loading ? (
          <p className="text-xs text-stone-500 italic">Listening for meaning…</p>
        ) : (
          <p className="text-xs text-stone-600 italic">—</p>
        )}
      </div>
    </div>
  );
}

// The classic Celtic Cross positions. Uses percentage coordinates within a
// square-ish board so cards land in the traditional cross + staff layout.
const CELTIC_POSITIONS: Record<number, { x: number; y: number; rotate?: number; z?: number }> = {
  0: { x: 38, y: 50, z: 1 },              // 1. Significator (center)
  1: { x: 38, y: 50, rotate: 90, z: 2 },  // 2. Crossing (over 1)
  2: { x: 38, y: 82 },                    // 3. Below
  3: { x: 15, y: 50 },                    // 4. Left (past)
  4: { x: 38, y: 18 },                    // 5. Above (crown)
  5: { x: 61, y: 50 },                    // 6. Right (future)
  6: { x: 86, y: 84 },                    // 7. Self
  7: { x: 86, y: 64 },                    // 8. Environment
  8: { x: 86, y: 42 },                    // 9. Hopes / fears
  9: { x: 86, y: 20 },                    // 10. Outcome
};

function CelticCrossBoard({ drawn }: { drawn: Drawn[] }) {
  return (
    <div className="relative w-full mx-auto rounded-2xl border border-amber-100/10 bg-black/30 backdrop-blur"
      style={{ maxWidth: 640, aspectRatio: "1 / 0.9" }}>
      {drawn.map((d) => {
        const pos = CELTIC_POSITIONS[d.position];
        if (!pos) return null;
        const img = tarotImageUrl(d.code);
        const rot = (pos.rotate ?? 0) + (d.reversed && pos.rotate == null ? 180 : 0);
        // Significator label goes to the left so it isn't hidden by the crossing card.
        const labelLeft = d.position === 0;
        return (
          <div key={`${d.position}-${d.code}`}
            className="absolute"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: "translate(-50%, -50%)",
              zIndex: pos.z ?? 0,
            }}
            title={`${d.position + 1}. ${d.label} — ${d.name}`}>
            <div className="relative">
              <div className="rounded-md overflow-hidden border border-amber-200/30 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)] bg-black/40"
                style={{ width: 68, aspectRatio: "0.58", transform: `rotate(${rot}deg)` }}>
                {img ? (
                  <img src={img} alt={d.name} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[9px] text-amber-100/70 p-1 text-center">{d.name}</div>
                )}
              </div>
              <div
                className="absolute text-[10px] tracking-widest text-amber-200/80 font-serif"
                style={
                  labelLeft
                    ? { right: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)" }
                    : { left: "50%", bottom: "-18px", transform: "translateX(-50%)" }
                }
              >
                {d.position + 1}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IChingBoard({ drawn }: { drawn: Drawn[] }) {
  const withLines = drawn.filter((d) => d.lines?.length === 6);
  if (!withLines.length) return null;
  return (
    <div className="rounded-2xl border border-amber-100/10 bg-black/30 backdrop-blur p-6 flex flex-wrap justify-center gap-12">
      {withLines.map((d) => (
        <div key={`${d.position}-${d.code}`} className="flex flex-col items-center">
          <div className="text-[10px] tracking-[0.3em] uppercase text-amber-200/60 mb-3">{d.label}</div>
          <HexagramGlyph lines={d.lines!} size={150} />
          <div className="mt-3 font-serif text-lg text-amber-50">{d.name}</div>
          {d.changing?.length ? (
            <div className="mt-1 text-[10px] text-rose-300/80 tracking-wider">
              changing: {d.changing.map((n) => n + 1).join(", ")}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
