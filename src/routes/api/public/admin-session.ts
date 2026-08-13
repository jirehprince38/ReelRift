import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/admin-session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getSession } = await import("@/lib/admin-auth.server");
        return Response.json(
          { loggedIn: !!getSession(request) },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
