/* =========================================================
   Server-side TMDb proxy.
   The client calls /api/tmdb?path=/movie/popular&page=1
   and this function injects the secret API key, which is
   never exposed to the browser.
   ========================================================= */
const TMDB_BASE = "https://api.themoviedb.org/3";

module.exports = async function handler(req, res) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "TMDb API key is not configured on the server." });
    return;
  }

  // Vercel populates req.query for query params.
  const query = req.query || {};
  let path = query.path || "";

  // Only allow relative TMDb paths (must start with a single slash).
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") || path.includes("..")) {
    res.status(400).json({ error: "Invalid path." });
    return;
  }

  const url = new URL(TMDB_BASE + path);
  url.searchParams.set("api_key", apiKey);
  Object.keys(query).forEach(function (k) {
    if (k === "path") return;
    url.searchParams.set(k, query[k]);
  });

  try {
    const upstream = await fetch(url.toString());
    const text = await upstream.text();
    // Cache successful responses briefly at the edge to cut TMDb calls.
    if (upstream.ok) res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(upstream.status).send(text);
  } catch (e) {
    res.status(502).json({ error: "Failed to reach TMDb." });
  }
};
