import { getSession, readBody, sb } from "./_auth.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const data = await sb("announcements?select=id,title,body,pinned,created_at&order=pinned.desc,created_at.desc&limit=50", {
        headers: { Prefer: "return=representation" },
      });
      return res.status(200).json({ announcements: data || [] });
    }

    if (!getSession(req)) return res.status(401).json({ error: "Unauthorized" });

    if (req.method === "POST") {
      const body = await readBody(req);
      const title = (body.title || "").trim();
      const text = (body.body || "").trim();
      if (!title || !text) return res.status(400).json({ error: "Title and body are required." });
      if (title.length > 160 || text.length > 4000) return res.status(400).json({ error: "Title or body is too long." });
      await sb("announcements", { method: "POST", body: JSON.stringify({ title, body: text, pinned: !!body.pinned }) });
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const id = new URL(req.url, "http://localhost").searchParams.get("id");
      if (!id) return res.status(400).json({ error: "Missing id." });
      await sb(`announcements?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error." });
  }
}
