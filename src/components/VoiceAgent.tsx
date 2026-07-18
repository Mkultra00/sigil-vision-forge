import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceContext = {
  question?: string;
  birthdate?: string;
  spread?: string;
  drawn?: Array<{ label: string; name: string; reversed?: boolean; keywords?: string[] }>;
  synthesis?: string;
  positions?: Array<{ position: number; significance: string }>;
  sigil?: { statement: string; reduced: string; has_image: boolean } | null;
  vision?: { prompt: string; has_image: boolean } | null;
  history?: Array<{
    question?: string;
    spread?: string;
    system?: string;
    drawn: Array<{ label: string; name: string; reversed?: boolean }>;
    synthesis?: string;
  }>;
};

export type VoiceApi = {
  speak: (text: string) => Promise<void>;
  isConnected: () => boolean;
};

export function VoiceAgent({ context, onReady }: { context?: VoiceContext; onReady?: (api: VoiceApi) => void }) {
  return (
    <ConversationProvider>
      <VoiceAgentInner context={context} onReady={onReady} />
    </ConversationProvider>
  );
}

function summarize(ctx?: VoiceContext): string {
  const historyBlock = ctx?.history?.length
    ? "\n\nPrior readings this session (oldest first):\n" +
      ctx.history
        .map((h, i) => {
          const cards = h.drawn.map((d) => `${d.label}: ${d.name}${d.reversed ? " (rev)" : ""}`).join("; ");
          return `(${i + 1}) [${h.system ?? "?"}${h.spread ? ` · ${h.spread}` : ""}] Q: ${h.question || "(unspoken)"} — ${cards}${h.synthesis ? ` — ${h.synthesis}` : ""}`;
        })
        .join("\n")
    : "";
  if (!ctx || !ctx.drawn?.length) return `The seeker has not yet drawn a reading.${historyBlock}`;
  const lines = ctx.drawn
    .map((d) => `• ${d.label}: ${d.name}${d.reversed ? " (reversed)" : ""}${d.keywords?.length ? ` — ${d.keywords.slice(0, 3).join(", ")}` : ""}`)
    .join("\n");
  const posNotes = ctx.positions?.length
    ? "\nPer-position significance:\n" +
      ctx.positions.map((p) => `#${p.position + 1}: ${p.significance}`).join("\n")
    : "";
  const sigilBlock = ctx.sigil
    ? `\n\nActive sigil on the altar — intent: "${ctx.sigil.statement}"; reduced glyph-letters: ${ctx.sigil.reduced}${ctx.sigil.has_image ? " (an ornamented sigil image is visible to the seeker)" : ""}.`
    : "";
  const visionBlock = ctx.vision
    ? `\n\nA summoned vision is present${ctx.vision.has_image ? " (image rendered)" : ""} — its prompt: ${ctx.vision.prompt}`
    : "";
  const birthLine = ctx.birthdate ? `\nSeeker's birthdate: ${ctx.birthdate}.` : "";
  return `The seeker asked: ${ctx.question || "(unspoken)"}.${birthLine}
Spread: ${ctx.spread ?? "unknown"}.
Cards drawn:
${lines}${posNotes}
${ctx.synthesis ? `\nSynthesis so far: ${ctx.synthesis}` : ""}${sigilBlock}${visionBlock}${historyBlock}

When you speak, weave the cards, the sigil, and the vision together into one synthesis — explain how they reinforce or complicate one another for the seeker.`;
}

function VoiceAgentInner({ context, onReady }: { context?: VoiceContext; onReady?: (api: VoiceApi) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const lastSent = useRef<string>("");

  const conversation = useConversation({
    onError: (e) => setErr(typeof e === "string" ? e : "Voice error"),
  });

  const start = useCallback(async () => {
    setErr(null); setBusy(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = await fetch("/api/elevenlabs/token");
      if (!r.ok) throw new Error(await r.text());
      const { token } = (await r.json()) as { token: string };
      await conversation.startSession({ conversationToken: token, connectionType: "webrtc" });
      // Seed the agent with the current reading, if any.
      const summary = summarize(context);
      lastSent.current = summary;
      try { conversation.sendContextualUpdate(summary); } catch { /* noop */ }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }, [conversation, context]);

  const stop = useCallback(() => { void conversation.endSession(); }, [conversation]);

  const connected = conversation.status === "connected";
  const speaking = conversation.isSpeaking;

  const connectedRef = useRef(connected);
  useEffect(() => { connectedRef.current = connected; }, [connected]);

  const speak = useCallback(async (text: string) => {
    if (!text.trim()) return;
    if (!connectedRef.current) {
      await start();
      // wait briefly for session to be ready
      for (let i = 0; i < 40 && !connectedRef.current; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    try { conversation.sendUserMessage(text); } catch { /* noop */ }
  }, [conversation, start]);

  useEffect(() => {
    onReady?.({ speak, isConnected: () => connectedRef.current });
  }, [onReady, speak]);

  // Push updated reading context to the live agent whenever it changes.
  useEffect(() => {
    if (!connected) return;
    const summary = summarize(context);
    if (summary === lastSent.current) return;
    lastSent.current = summary;
    try { conversation.sendContextualUpdate(summary); } catch { /* noop */ }
  }, [context, connected, conversation]);

  return (
    <section className="mt-16 rounded-2xl border border-amber-100/10 bg-black/30 backdrop-blur p-6 md:p-8">
      <div className="text-xs tracking-[0.3em] uppercase text-amber-200/60 mb-3">Voice — the Shaman speaks</div>
      <p className="text-sm text-stone-400 mb-4">
        Grant the microphone. Speak. The Shaman sees the cards you draw.
      </p>
      <div className="flex flex-wrap gap-3 items-center">
        {!connected ? (
          <button onClick={start} disabled={busy}
            className="px-5 py-2 rounded-full bg-amber-100/90 text-stone-900 text-sm hover:bg-amber-50 disabled:opacity-50">
            {busy ? "Opening the channel…" : "Begin"}
          </button>
        ) : (
          <button onClick={stop}
            className="px-5 py-2 rounded-full border border-rose-300/50 text-rose-200 text-sm hover:bg-rose-500/10">
            End
          </button>
        )}
        {connected && context?.drawn?.length ? (
          <button
            onClick={() => {
              try { conversation.sendUserMessage("Please interpret the cards I have drawn."); } catch { /* noop */ }
            }}
            className="px-4 py-2 rounded-full border border-amber-200/40 text-amber-100 text-xs tracking-widest uppercase hover:bg-amber-100/5"
          >
            Ask the Shaman to interpret
          </button>
        ) : null}
      </div>
      {connected && (
        <div className="mt-4 flex items-center gap-3 text-xs">
          <span className={`h-2 w-2 rounded-full ${speaking ? "bg-amber-300 animate-pulse" : "bg-emerald-400"}`} />
          <span className="text-stone-300">{speaking ? "Speaking…" : "Listening…"}</span>
        </div>
      )}
      {err && <p className="mt-3 text-sm text-rose-300/90">{err}</p>}
    </section>
  );
}