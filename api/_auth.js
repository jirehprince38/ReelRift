/* =========================================================
   Shared admin-session helpers (server-side only).
   Signs a small session token with HMAC-SHA256 using
   ADMIN_SECRET so the cookie cannot be forged by the client.
   ========================================================= */
const crypto = require("crypto");

const COOKIE_NAME = "rr_admin";
const MAX_AGE = 60 * 60 * 8; // 8 hours

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign(data, secret) {
  return b64url(crypto.createHmac("sha256", secret).update(data).digest());
}

/* Create a signed token: base64url(payload).signature */
function createToken(username, secret) {
  const payload = b64url(
    JSON.stringify({ u: username, exp: Math.floor(Date.now() / 1000) + MAX_AGE })
  );
  return payload + "." + sign(payload, secret);
}

/* Verify a signed token; returns the payload object or null */
function verifyToken(token, secret) {
  if (!token || typeof token !== "string" || token.indexOf(".") === -1) return null;
  const [payload, sig] = token.split(".");
  const expected = sign(payload, secret);
  // constant-time compare
  const a = Buffer.from(sig || "");
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch (e) {
    return null;
  }
}

/* Read a cookie value from the request */
function readCookie(req, name) {
  const header = req.headers.cookie || "";
  const parts = header.split(";");
  for (let i = 0; i < parts.length; i++) {
    const [k, ...rest] = parts[i].trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/* Returns the verified session payload, or null if not logged in */
function getSession(req) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return null;
  return verifyToken(readCookie(req, COOKIE_NAME), secret);
}

module.exports = {
  COOKIE_NAME,
  MAX_AGE,
  createToken,
  verifyToken,
  readCookie,
  getSession,
};
