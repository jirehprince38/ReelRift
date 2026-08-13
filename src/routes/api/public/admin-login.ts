import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/admin-login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { createToken, safeEqual, COOKIE_NAME, MAX_AGE } = await import(
          "@/lib/admin-auth.server"
        );

        const secret = process.env["ADMIN_SECRET"];
        const user = process.env["ADMIN_USERNAME"];
        const pass = process.env["ADMIN_PASSWORD"];
        if (!secret || !user || !pass) {
          return Response.json(
            { error: "Admin auth is not configured on the server." },
            { status: 500 },
          );
        }

        let body: { username?: string; password?: string } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          body = {};
        }

        const ok =
          safeEqual(body.username || "", user) && safeEqual(body.password || "", pass);
        if (!ok) {
          return Response.json({ error: "Invalid username or password." }, { status: 401 });
        }

        const token = createToken(user, secret);
        return Response.json(
          { ok: true },
          {
            headers: {
              "Set-Cookie": `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`,
            },
          },
        );
      },
    },
  },
});
