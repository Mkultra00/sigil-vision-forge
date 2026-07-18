import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ reading_id: z.string().uuid() });

export const generateVision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const { data: reading, error } = await supabase
      .from("readings")
      .select("id, question, system, drawn")
      .eq("id", data.reading_id)
      .maybeSingle();
    if (error || !reading) throw new Error("Reading not found");

    const drawn = reading.drawn as Array<{ name: string; keywords: string[]; reversed?: boolean }>;
    const symbols = drawn
      .map((d) => `${d.name}${d.reversed ? " (reversed)" : ""} — ${(d.keywords ?? []).slice(0, 3).join(", ")}`)
      .join("; ");
    const model = "openai/gpt-image-2";
    const prompt = `A single symbolic dreamlike painting evoking a divinatory reading. Question: ${reading.question ?? "(unspoken)"}. Symbols to weave: ${symbols}. Style: mystical, painterly, warm candlelight, deep indigo and gold, symbolic realism, no text, no letters, no tarot card frames.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, size: "1024x1024", quality: "low", n: 1 }),
    });
    if (!res.ok) throw new Error(`vision gen failed: ${res.status} ${await res.text().catch(() => "")}`);
    const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("no image returned");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `${userId}/${crypto.randomUUID()}.png`;
    const up = await supabase.storage
      .from("visions")
      .upload(path, bytes, { contentType: "image/png", upsert: false });
    if (up.error) throw new Error(up.error.message);

    const { error: insErr } = await supabase.from("visions").insert({
      user_id: userId,
      reading_id: reading.id,
      prompt,
      storage_path: path,
      model,
    });
    if (insErr) throw new Error(insErr.message);

    const { data: signed } = await supabase.storage.from("visions").createSignedUrl(path, 3600);
    return { image_url: signed?.signedUrl ?? null, prompt };
  });