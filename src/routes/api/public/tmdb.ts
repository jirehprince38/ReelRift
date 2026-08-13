import { createFileRoute } from "@tanstack/react-router";

const TMDB_BASE = "https://api.themoviedb.org/3";

export const Route = createFileRoute("/api/public/tmdb")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const apiKey = process.env["TMDB_API_KEY"];
        if (!apiKey) {
          return Response.json(
            { error: "TMDb API key is not configured on the server." },
            { status: 500 },
          );
        }

        const incoming = new URL(request.url);
        const path = incoming.searchParams.get("path") || "";
        if (!path.startsWith("/") || path.startsWith("//") || path.includes("..")) {
          return Response.json({ error: "Invalid path." }, { status: 400 });
        }

        const url = new URL(TMDB_BASE + path);
        url.searchParams.set("api_key", apiKey);
        incoming.searchParams.forEach((value, key) => {
          if (key !== "path") url.searchParams.set(key, value);
        });

        try {
          const upstream = await fetch(url.toString());
          const text = await upstream.text();
          return new Response(text, {
            status: upstream.status,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": upstream.ok
                ? "public, s-maxage=300, stale-while-revalidate=600"
                : "no-store",
            },
          });
        } catch {
          return Response.json({ error: "Failed to reach TMDb." }, { status: 502 });
        }
      },
    },
  },
});
