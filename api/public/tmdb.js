const TMDB_BASE = "https://api.themoviedb.org/3";

export default async function handler(req, res) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "TMDb API key is not configured on the server." });

  const incoming = new URL(req.url, "http://localhost");
  const path = incoming.searchParams.get("path") || "";
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("..")) {
    return res.status(400).json({ error: "Invalid path." });
  }

  const url = new URL(TMDB_BASE + path);
  url.searchParams.set("api_key", apiKey);
  incoming.searchParams.forEach((value, key) => {
    if (key !== "path") url.searchParams.set(key, value);
  });

  try {
    const upstream = await fetch(url.toString());
    const text = await upstream.text();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", upstream.ok ? "public, s-maxage=300, stale-while-revalidate=600" : "no-store");
    return res.status(upstream.status).send(text);
  } catch {
    return res.status(502).json({ error: "Failed to reach TMDb." });
  }
}
