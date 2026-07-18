import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  question: z.string().optional(),
  intent: z.string().optional(),
  context_summary: z.string().optional(),
  birthdate: z.string().optional(),
});

export type Spell = {
  mantra: string;
  affirmation: string;
  focus_instructions: string;
  mandala_seed: string;
};

export const castSpell = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<Spell> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const focus = data.intent?.trim() || data.question?.trim() || "clarity and quiet power";
    const sys = `You are a shaman crafting a manifestation spell for a seeker. Return ONLY JSON with keys:
- mantra: a short sacred phrase 3-7 words, easily repeated in one breath, evocative and rhythmic. No punctuation except a single dot at the end optional.
- affirmation: one sentence (max 25 words) in first person present tense stating the desired reality as if already true.
- focus_instructions: 2-3 sentences guiding the seeker how to sit, breathe, gaze at the mandala, and repeat the mantra. Warm, quiet, ritual tone.
- mandala_seed: a short evocative phrase (2-6 words) that will seed the geometry of the mandala.
No prose, no commentary, JSON only.`;
    const user = `Focus of the spell: ${focus}
${data.context_summary ? `Context from the reading/altar:\n${data.context_summary}` : ""}
${data.birthdate ? `Seeker birthdate: ${data.birthdate}` : ""}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`spell gen failed: ${res.status} ${await res.text().catch(() => "")}`);
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: Partial<Spell> = {};
    try { parsed = JSON.parse(content) as Partial<Spell>; } catch { /* noop */ }
    return {
      mantra: parsed.mantra?.trim() || "I am the still center of the turning world.",
      affirmation: parsed.affirmation?.trim() || `I welcome ${focus} into my life now.`,
      focus_instructions: parsed.focus_instructions?.trim() || "Sit quietly. Soften your gaze on the mandala's center. Breathe in for four, out for six, and let the mantra move with your breath.",
      mandala_seed: parsed.mandala_seed?.trim() || focus,
    };
  });