import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/admin-logout")({
  server: {
    handlers: {
      POST: async () => {
        const { COOKIE_NAME } = await import("@/lib/admin-auth.server");
        return Response.json(
          { ok: true },
          {
            headers: {
              "Set-Cookie": `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`,
            },
          },
        );
      },
    },
  },
});
