import { getSession, readBody, sb } from "./_auth.js";

const CATEGORIES = ["general", "broken_video", "wrong_title", "bug", "request"];

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "POST") {
      const body = await readBody(req);
      const message = (body.message || "").trim();
      if (message.length < 5) return res.status(400).json({ error: "Please describe the issue." });
      if (message.length > 4000) return res.status(400).json({ error: "Message is too long." });
      const email = (body.email || "").trim();
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return res.status(400).json({ error: "Please enter a valid email address." });
      }
      const category = CATEGORIES.includes(body.category || "") ? body.category : "general";
      await sb("reports", {
        method: "POST",
        body: JSON.stringify({
          name: (body.name || "").trim().slice(0, 120) || null,
          email: email.slice(0, 160) || null,
          category,
          message,
        }),
      });
      return res.status(200).json({ ok: true });
    }

    if (!getSession(req)) return res.status(401).json({ error: "Unauthorized" });

    if (req.method === "GET") {
      const data = await sb("reports?select=id,name,email,category,message,handled,created_at&order=created_at.desc&limit=200", {
        headers: { Prefer: "return=representation" },
      });
      return res.status(200).json({ reports: data || [] });
    }

    if (req.method === "PATCH") {
      const body = await readBody(req);
      if (!body.id) return res.status(400).json({ error: "Missing id." });
      await sb(`reports?id=eq.${encodeURIComponent(body.id)}`, { method: "PATCH", body: JSON.stringify({ handled: !!body.handled }) });
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const id = new URL(req.url, "http://localhost").searchParams.get("id");
      if (!id) return res.status(400).json({ error: "Missing id." });
      await sb(`reports?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error." });
  }
}
