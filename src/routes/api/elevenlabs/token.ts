import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/elevenlabs/token")({
  server: {
    handlers: {
      GET: async () => {
        const agent_id = process.env.ELEVENLABS_AGENT_ID;
        const key = process.env.ELEVENLABS_API_KEY;
        if (!agent_id) return new Response("ELEVENLABS_AGENT_ID not set", { status: 500 });
        if (!key) return new Response("ElevenLabs not connected", { status: 500 });
        const r = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agent_id)}`,
          { headers: { "xi-api-key": key } },
        );
        if (!r.ok) return new Response(await r.text(), { status: r.status });
        const { token } = (await r.json()) as { token: string };
        return Response.json({ token });
      },
    },
  },
});