import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildSigilSvg, reduceLetters } from "./sigil-svg";

const Input = z.object({
  intent: z.string().min(3).max(200),
  source_upload_id: z.string().uuid().optional(),
  ornament: z.boolean().default(true),
});

export const generateSigil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Build "statement of intent" — the chaos-magic form.
    const statement = data.intent.trim().toUpperCase().startsWith("IT IS MY WILL")
      ? data.intent
      : `IT IS MY WILL ${data.intent.trim()}`;
    const reduced = reduceLetters(statement);
    const svg = buildSigilSvg(reduced, 512);

    const svgPath = `${userId}/${crypto.randomUUID()}.svg`;
    const svgUpload = await supabase.storage
      .from("sigils")
      .upload(svgPath, new Blob([svg], { type: "image/svg+xml" }), {
        contentType: "image/svg+xml",
        upsert: false,
      });
    if (svgUpload.error) throw new Error(`sigil svg upload: ${svgUpload.error.message}`);

    let ornamentPath: string | null = null;
    let prompt: string | null = null;
    let model: string | undefined;

    if (data.ornament) {
      const apiKey = process.env.LOVABLE_API_KEY;
      if (apiKey) {
        model = "google/gemini-3.1-flash-image";
        prompt = `Esoteric sigil, hand-inked on aged parchment. Center this exact abstract geometric glyph shape (single continuous line connecting points on a circle) and adorn it with delicate occult ornamentation: alchemical marks, a thin astrological ring, tiny hand-drawn symbols. Statement of intent: "${statement}". Palette: deep indigo background, warm gold and cream ink. Symmetrical, ceremonial, no text, no letters.`;
          try {
          const svgB64 = Buffer.from(svg).toString("base64");
          const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { url: `data:image/svg+xml;base64,${svgB64}` } },
                  ],
                },
              ],
              modalities: ["image", "text"],
            }),
          });
          if (res.ok) {
            const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
            const b64 = json.data?.[0]?.b64_json;
            if (b64) {
              const png = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
              ornamentPath = `${userId}/${crypto.randomUUID()}.png`;
              const up = await supabase.storage
                .from("sigils")
                .upload(ornamentPath, png, { contentType: "image/png", upsert: false });
              if (up.error) ornamentPath = null;
            }
          } else {
            console.warn("sigil ornament failed", res.status, await res.text().catch(() => ""));
          }
        } catch (e) {
          console.warn("sigil ornament error", e);
        }
      }
    }

    const finalPath = ornamentPath ?? svgPath;
    const { data: row, error } = await supabase
      .from("sigils")
      .insert({
        user_id: userId,
        source_upload_id: data.source_upload_id ?? null,
        intent: data.intent,
        statement,
        letters_reduced: reduced,
        svg,
        storage_path: finalPath,
        prompt,
        model,
      })
      .select("id, storage_path, svg")
      .single();
    if (error) throw new Error(error.message);

    const { data: signed } = await supabase.storage
      .from("sigils")
      .createSignedUrl(finalPath, 3600);

    return {
      id: row.id,
      statement,
      reduced,
      svg,
      image_url: signed?.signedUrl ?? null,
      ornamented: Boolean(ornamentPath),
    };
  });