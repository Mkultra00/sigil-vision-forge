import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceContext = {
  question?: string;
  spread?: string;
  drawn?: Array<{ label: string; name: string; reversed?: boolean; keywords?: string[] }>;
  synthesis?: string;
  positions?: Array<{ position: number; significance: string }>;
};

export function VoiceAgent({ context }: { context?: VoiceContext }) {
  return (
    <ConversationProvider>
      <VoiceAgentInner context={context} />
    </ConversationProvider>
  );
}

function summarize(ctx?: VoiceContext): string {
  if (!ctx || !ctx.drawn?.length) return "The seeker has not yet drawn a reading.";
  const lines = ctx.drawn
    .map((d) => `• ${d.label}: ${d.name}${d.reversed ? " (reversed)" : ""}${d.keywords?.length ? ` — ${d.keywords.slice(0, 3).join(", ")}` : ""}`)
    .join("\n");
  const posNotes = ctx.positions?.length
    ? "\nPer-position significance:\n" +
      ctx.positions.map((p) => `#${p.position + 1}: ${p.significance}`).join("\n")
    : "";
  return `The seeker asked: ${ctx.question || "(unspoken)"}.
Spread: ${ctx.spread ?? "unknown"}.
Cards drawn:
${lines}${posNotes}
${ctx.synthesis ? `\nSynthesis so far: ${ctx.synthesis}` : ""}`;
}

function VoiceAgentInner({ context }: { context?: VoiceContext }) {
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