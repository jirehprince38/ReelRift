/* =========================================================
   Admin login. Validates credentials against server-side
   environment variables and sets an HttpOnly signed cookie.
   No credentials ever live in client code.
   ========================================================= */
const crypto = require("crypto");
const { createToken, COOKIE_NAME, MAX_AGE } = require("./_auth");

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  return await new Promise(function (resolve) {
    let raw = "";
    req.on("data", function (c) { raw += c; });
    req.on("end", function () {
      try { resolve(JSON.parse(raw || "{}")); } catch (e) { resolve({}); }
    });
    req.on("error", function () { resolve({}); });
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const secret = process.env.ADMIN_SECRET;
  const user = process.env.ADMIN_USERNAME;
  const pass = process.env.ADMIN_PASSWORD;
  if (!secret || !user || !pass) {
    res.status(500).json({ error: "Admin auth is not configured on the server." });
    return;
  }

  const body = await readBody(req);
  const okUser = safeEqual(body.username || "", user);
  const okPass = safeEqual(body.password || "", pass);

  if (!okUser || !okPass) {
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }

  const token = createToken(user, secret);
  res.setHeader(
    "Set-Cookie",
    COOKIE_NAME + "=" + encodeURIComponent(token) +
      "; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=" + MAX_AGE
  );
  res.status(200).json({ ok: true });
};
