import { createToken, safeEqual, readBody, COOKIE_NAME, MAX_AGE } from "./_auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const secret = process.env.ADMIN_SECRET;
  const user = process.env.ADMIN_USERNAME;
  const pass = process.env.ADMIN_PASSWORD;
  if (!secret || !user || !pass) return res.status(500).json({ error: "Admin auth is not configured on the server." });

  const body = await readBody(req);
  const ok = safeEqual(body.username || "", user) && safeEqual(body.password || "", pass);
  if (!ok) return res.status(401).json({ error: "Invalid username or password." });

  const token = createToken(user, secret);
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`);
  return res.status(200).json({ ok: true });
}
