import { useConversation } from "@elevenlabs/react";
import { useCallback, useEffect, useState } from "react";

const LS_KEY = "shaman.elevenlabs.agentId";

export function VoiceAgent() {
  const [agentId, setAgentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) setAgentId(saved);
  }, []);

  const conversation = useConversation({
    onError: (e) => setErr(typeof e === "string" ? e : "Voice error"),
  });

  const start = useCallback(async () => {
    setErr(null); setBusy(true);
    try {
      localStorage.setItem(LS_KEY, agentId.trim());
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = await fetch("/api/elevenlabs/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId.trim() }),
      });
      if (!r.ok) throw new Error(await r.text());
      const { token } = (await r.json()) as { token: string };
      await conversation.startSession({ conversationToken: token, connectionType: "webrtc" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }, [agentId, conversation]);

  const stop = useCallback(() => { void conversation.endSession(); }, [conversation]);

  const connected = conversation.status === "connected";
  const speaking = conversation.isSpeaking;

  return (
    <section className="mt-16 rounded-2xl border border-amber-100/10 bg-black/30 backdrop-blur p-6 md:p-8">
      <div className="text-xs tracking-[0.3em] uppercase text-amber-200/60 mb-3">Voice — the Shaman speaks</div>
      <p className="text-sm text-stone-400 mb-4">
        Paste your ElevenLabs Agent ID. Grant the microphone. Speak.
      </p>
      <div className="flex flex-wrap gap-3 items-center">
        <input
          value={agentId} onChange={(e) => setAgentId(e.target.value)}
          placeholder="agent_xxxxxxxxxxxxxxxxxxxxxxxxxx"
          disabled={connected}
          className="flex-1 min-w-[260px] bg-transparent border-b border-amber-100/20 focus:border-amber-200/60 outline-none py-2 text-amber-50 placeholder:text-stone-500 font-mono text-sm disabled:opacity-60"
        />
        {!connected ? (
          <button onClick={start} disabled={busy || !agentId.trim()}
            className="px-5 py-2 rounded-full bg-amber-100/90 text-stone-900 text-sm hover:bg-amber-50 disabled:opacity-50">
            {busy ? "Opening the channel…" : "Begin"}
          </button>
        ) : (
          <button onClick={stop}
            className="px-5 py-2 rounded-full border border-rose-300/50 text-rose-200 text-sm hover:bg-rose-500/10">
            End
          </button>
        )}
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