import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PriorReading = z.object({
  question: z.string().nullable().optional(),
  system: z.string(),
  spread: z.string().optional(),
  drawn: z.array(z.object({
    label: z.string(),
    name: z.string(),
    reversed: z.boolean().optional(),
    keywords: z.array(z.string()).optional(),
  })),
  synthesis: z.string().optional(),
});
const Input = z.object({
  reading_id: z.string().uuid(),
  history: z.array(PriorReading).max(20).optional(),
  birthdate: z.string().max(32).optional(),
});

type Drawn = {
  position: number;
  label: string;
  hint: string;
  name: string;
  keywords?: string[];
  text: string;
  reversed?: boolean;
  changing?: number[];
};

export const interpretReading = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const { data: reading, error } = await supabase
      .from("readings")
      .select("id, question, system, spread_slug, drawn")
      .eq("id", data.reading_id)
      .maybeSingle();
    if (error || !reading) throw new Error("Reading not found");

    const drawn = reading.drawn as Drawn[];
    const list = drawn
      .map(
        (d, i) =>
          `${i + 1}. Position "${d.label}" (${d.hint}): ${d.name}${d.reversed ? " reversed" : ""} — keywords: ${(d.keywords ?? []).join(", ")}${d.changing?.length ? ` — changing lines: ${d.changing.map((n) => n + 1).join(", ")}` : ""}`,
      )
      .join("\n");

    const system = `You are a soft-spoken diviner. Write in second person, present tense, gentle, poetic but concrete. No disclaimers. No lists inside paragraphs. When prior readings are given, treat them as the ongoing arc of this seeker: reference and build on them, note echoes, contrasts, and how the current draw answers or turns what came before. Return STRICT JSON only.`;
    const priorBlock = (data.history ?? []).length
      ? `\n\nPrior readings in this session (oldest first):\n` +
        (data.history ?? [])
          .map((h, i) => {
            const cards = h.drawn
              .map((d) => `${d.label}: ${d.name}${d.reversed ? " (rev)" : ""}`)
              .join("; ");
            return `(${i + 1}) [${h.system}${h.spread ? ` · ${h.spread}` : ""}] Q: ${h.question ?? "(unspoken)"} — ${cards}${h.synthesis ? ` — synthesis: ${h.synthesis}` : ""}`;
          })
          .join("\n")
      : "";
    const birthBlock = data.birthdate ? `\nSeeker's birthdate: ${data.birthdate}. Let it subtly color the tone (season, elemental cast, life-cycle), without astrological jargon unless the cards invite it.` : "";
    const user = `System: ${reading.system}. Spread: ${reading.spread_slug}. Question: ${reading.question ?? "(unspoken)"}.${birthBlock}${priorBlock}
Drawn:
${list}

Return JSON with this exact shape:
{
  "positions": [{ "position": <number>, "significance": "<2-3 sentences on what THIS symbol means in THIS position for the question>" }, ...],
  "synthesis": "<one short paragraph, 3-5 sentences, weaving the symbols together into a single reading>"
}
Include one positions entry per drawn symbol, matched by its position number.`;

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
    if (!res.ok) throw new Error(`interpret failed: ${res.status} ${await res.text().catch(() => "")}`);
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { positions?: Array<{ position: number; significance: string }>; synthesis?: string } = {};
    try { parsed = JSON.parse(content); } catch { /* fallthrough */ }
    return {
      positions: parsed.positions ?? [],
      synthesis: parsed.synthesis ?? "",
    };
  });