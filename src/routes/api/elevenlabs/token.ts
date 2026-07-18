import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/elevenlabs/token")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { agent_id } = (await request.json()) as { agent_id?: string };
        if (!agent_id) return new Response("Missing agent_id", { status: 400 });
        const key = process.env.ELEVENLABS_API_KEY;
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