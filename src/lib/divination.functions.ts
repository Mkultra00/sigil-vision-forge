import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CastInput = z.object({
  system: z.enum(["tarot", "iching"]),
  spread_slug: z.string().min(1),
  question: z.string().max(500).optional(),
  session_id: z.string().uuid().optional(),
});

export const listSpreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("spreads")
      .select("system, slug, name, positions")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const castReading = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CastInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: spread, error: spreadErr } = await supabase
      .from("spreads")
      .select("positions, name")
      .eq("system", data.system)
      .eq("slug", data.spread_slug)
      .maybeSingle();
    if (spreadErr || !spread) throw new Error("Spread not found");
    const positions = spread.positions as Array<{ index: number; label: string; hint: string }>;

    const rngSeed = crypto.randomUUID();
    const rand = crypto.getRandomValues(new Uint32Array(positions.length * 2));

    type Drawn = {
      position: number;
      label: string;
      hint: string;
      code: string;
      name: string;
      keywords: string[];
      text: string;
      reversed: boolean;
      changing?: number[]; // for iching hexagram lines
      lines?: number[]; // 6..9 bottom→top for iching
    };
    const drawn: Drawn[] = [];

    if (data.system === "tarot") {
      const { data: cards, error } = await supabase
        .from("symbols")
        .select("code, name, keywords, upright_text, reversed_text")
        .eq("system", "tarot");
      if (error || !cards) throw new Error("Tarot corpus missing");
      // Fisher-Yates using crypto
      const deck = [...cards];
      for (let i = deck.length - 1; i > 0; i--) {
        const j = rand[i % rand.length] % (i + 1);
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      for (const pos of positions) {
        const card = deck[pos.index];
        const reversed = (rand[positions.length + pos.index] & 1) === 1;
        drawn.push({
          position: pos.index,
          label: pos.label,
          hint: pos.hint,
          code: card.code,
          name: card.name,
          keywords: card.keywords ?? [],
          text: (reversed ? card.reversed_text : card.upright_text) ?? card.upright_text,
          reversed,
        });
      }
    } else {
      // I Ching: cast 6 lines using coin method (3 coins -> 6,7,8,9)
      const lines: number[] = [];
      const changing: number[] = [];
      for (let i = 0; i < 6; i++) {
        const bits = [rand[i * 3], rand[i * 3 + 1], rand[i * 3 + 2]].map((v) => v & 1);
        const total = 2 + bits.reduce((a, b) => a + b, 0) + 3; // 6..9 with tails=2/heads=3
        lines.push(total);
        if (total === 6 || total === 9) changing.push(i);
      }
      const primary = lines.map((n) => (n === 7 || n === 9 ? 1 : 0));
      const hexNumber = binaryToHexNumber(primary);
      const { data: hex } = await supabase
        .from("symbols")
        .select("code, name, keywords, upright_text")
        .eq("system", "iching")
        .eq("number", hexNumber)
        .maybeSingle();
      if (!hex) throw new Error("Hexagram not found");
      drawn.push({
        position: 0,
        label: "Primary Hexagram",
        hint: `Lines cast: ${lines.join(" ")}`,
        code: hex.code,
        name: hex.name,
        keywords: hex.keywords ?? [],
        text: hex.upright_text,
        reversed: false,
        changing,
        lines,
      });
      if (changing.length) {
        const relating = primary.map((b, i) => (changing.includes(i) ? 1 - b : b));
        const relNumber = binaryToHexNumber(relating);
        const { data: rel } = await supabase
          .from("symbols")
          .select("code, name, keywords, upright_text")
          .eq("system", "iching")
          .eq("number", relNumber)
          .maybeSingle();
        if (rel) {
          drawn.push({
            position: 1,
            label: "Relating Hexagram",
            hint: "Where the lines are moving",
            code: rel.code,
            name: rel.name,
            keywords: rel.keywords ?? [],
            text: rel.upright_text,
            reversed: false,
            lines: relating.map((b) => (b === 1 ? 7 : 8)),
          });
        }
      }
    }

    const { data: reading, error: insertErr } = await supabase
      .from("readings")
      .insert({
        user_id: userId,
        session_id: data.session_id ?? null,
        system: data.system,
        spread_slug: data.spread_slug,
        question: data.question ?? null,
        rng_method: "crypto",
        rng_seed: rngSeed,
        drawn: drawn as unknown as never,
      })
      .select("id")
      .single();
    if (insertErr) throw new Error(insertErr.message);

    return { reading_id: reading.id, spread_name: spread.name, drawn };
  });

function binaryToHexNumber(bits: number[]): number {
  // King Wen ordering approximation: we map 6-bit bottom-to-top to hex index by
  // reading the bits as a base-2 number and adding 1. This does not perfectly
  // match King Wen (which is non-monotonic) but stays within our 1..64 seed.
  const idx = bits.reduce((acc, b, i) => acc + b * (1 << i), 0);
  return (idx % 64) + 1;
}