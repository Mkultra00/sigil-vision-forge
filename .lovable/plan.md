
# The Shaman — MVP Build Plan

Adapting the architecture doc to this project's actual runtime (TanStack Start on Cloudflare Workers, Lovable Cloud for Supabase, Lovable AI Gateway for models). Voice is stubbed for now; everything else is real.

## 1. Backend (Lovable Cloud)

**Enable Lovable Cloud** (Supabase under the hood; auto-anon-auth for judges, RLS on).

**Schema (single migration).** Uses the doc's §4 shapes, adapted:

- `symbols` — tarot (78) + iching (64), public read
- `spreads` — `three_card`, `celtic_cross`, `hexagram_6line`
- `sessions`, `readings`, `uploads`, `visions` — user-scoped, RLS on `auth.uid()`
- `sigils` (new) — `id, user_id, source_upload_id, intent, statement, letters_reduced, svg, image_url, prompt, created_at`
- Storage buckets: `uploads` (private), `visions` (private, signed URLs), `sigils` (private), `card-art` (public)
- GRANTs and RLS per Lovable rules; `has_role` pattern not needed (no admin surface yet)

**Seed** tarot + hexagram rows in the same migration (deterministic, in-repo).

## 2. Server functions & routes

Instead of Supabase Edge Functions (Deno), everything is TanStack:

| Doc name | This project |
|---|---|
| `el-signed-url` | `src/routes/api/el-signed-url.ts` (stubbed — returns a mock session id for now) |
| `cast-reading` | `src/lib/cast.functions.ts` — `createServerFn`, deterministic RNG (crypto seed), returns drawn symbols + rng_seed |
| `read-symbols` | `src/lib/symbols.functions.ts` — reads seeded corpus, returns keyword bundles |
| `conjure-vision` | `src/lib/vision.functions.ts` — Lovable AI Gateway `openai/gpt-image-2`, streaming, uploads final PNG to `visions` bucket |
| `ingest-upload` | `src/lib/uploads.functions.ts` — signed upload URL + vision-model summary (`google/gemini-3.1-flash-image` for extraction) |
| `save-reading` / `recall-past-readings` | `src/lib/readings.functions.ts` |
| `conjure-sigil` (new) | `src/lib/sigil.functions.ts` — see §5 |

Rate-limit `conjure-vision` and `conjure-sigil` per session (in-DB counter).

## 3. Ritual page (`/ritual`) with live explainer visualizer

Layout (three zones, no chat window):

```text
┌───────────────────────────────────────────────┐
│  Ritual Canvas         │   Explainer Panel    │
│  (cards / hexagram)    │   ┌────────────────┐ │
│                        │   │ position: Past │ │
│  ┌──┐ ┌──┐ ┌──┐        │   │ card: 4 Swords │ │
│  │  │ │  │ │  │        │   │ keywords: rest,│ │
│  └──┘ └──┘ └──┘        │   │  retreat...    │ │
│                        │   │ upright meaning│ │
│  Offerings (upload)    │   └────────────────┘ │
│                        │                      │
│  Vision Pane           │   [Cast log stream]  │
│  (streaming image)     │                      │
├────────────────────────┴──────────────────────┤
│              Orb (speak / listening)           │
└───────────────────────────────────────────────┘
```

**Visualizer behavior (live, per your answer):**
- As each card flips (`reveal_card` tool), the panel animates in a card that shows: position label + role hint, card name, orientation, keyword chips, upright/reversed short meaning, and a highlighted excerpt of what the Shaman referenced (via `focus_symbol`).
- Keeps it read-only during a reading (no toggles/tabs competing with the voice). Full breakdown available later on `/readings/:id`.
- Subtle typography, low-contrast so the canvas stays the star.

## 4. Voice agent (stubbed)

- Client-tool interface identical to the real one: `reveal_card`, `draw_hexagram`, `focus_symbol`, `set_mood`, `show_vision`, `show_sigil`.
- `src/lib/mock-shaman.ts` — a scripted "conversation runner" that dispatches those same tool calls on a timer, so the ritual page is fully demoable without ElevenLabs.
- Swap to `@elevenlabs/react` later by replacing one provider component; nothing else changes.

## 5. Image → Sigil (hybrid SVG + AI ornamentation)

Flow:

1. User uploads an image or types an intent (statement of desire).
2. Server function `distillIntent` (Gemini vision + text) extracts a concise **intent statement** from the image + optional prompt.
3. **SVG base** (deterministic, chaos-magic tradition):
   - Reduce statement to unique consonants → glyphs
   - Map letters onto a rose/lattice grid (fixed seed from statement hash)
   - Connect points into a single continuous stroke, add terminals (circles, barbs)
   - Output clean monochrome SVG, stored in `sigils.svg`
4. **AI ornamentation**: pass the SVG (as PNG) + intent + reference image to `google/gemini-3.1-flash-image` with a tight prompt ("preserve linework exactly, add etched ornament, aged parchment, occult diagram annotations"). Streaming preview.
5. Store final in `sigils` bucket; display SVG-base and ornamented image side-by-side with the intent, glyph breakdown, and a "download" button.

Sigil UI: dedicated `/sigil` route + inline access from `/ritual` when the Shaman calls `show_sigil`.

## 6. Routes

```text
/                 landing — "Speak to the Shaman"
/ritual           voice session, canvas, visualizer, offerings, vision
/sigil            standalone sigil forge (upload + intent → sigil)
/readings         history
/readings/:id     shareable single reading (deep explainer)
```

Each route gets its own `head()` metadata (title, description, og:title/description). Home replaces the placeholder index.

## 7. Design direction

Deep navy `#0A1A2F`, electric cyan `#1FC8DE`, amber gold `#E0A516` as in the doc — mapped to semantic tokens in `src/styles.css` (oklch). Serif display for card names, mono for cast log. No purple-gradient AI aesthetic.

## 8. Build order

1. Enable Lovable Cloud + run schema migration with seeded corpus
2. Server functions: `cast`, `read-symbols`, `save-reading`, `recall`
3. `/ritual` skeleton + mock-shaman + client tool dispatcher
4. Ritual Canvas (tarot flip + hexagram lines) + Explainer Panel
5. Uploads pipeline + `ingest-upload`
6. `conjure-vision` streaming into Vision Pane
7. Sigil pipeline: SVG generator → AI ornamentation → `/sigil` page
8. `/readings` + `/readings/:id`
9. Landing page + design tokens polish
10. Real ElevenLabs swap (later, when keys are ready)

## Open items (won't block starting)

- ElevenLabs agent id / API key + OpenAI key: I'll skip until you're ready; the stub keeps the demo working.
- Whether sigil ornamentation should also stream progressive previews (default: yes, using `stream: true`).
- Auth: default to Lovable Cloud anonymous sign-in so nothing gates the demo.

Approve and I'll start with the schema + seed migration.
