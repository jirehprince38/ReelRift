import { createHmac, timingSafeEqual } from "crypto";

export const COOKIE_NAME = "rr_admin";
export const MAX_AGE = 60 * 60 * 8; // 8 hours

function b64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign(data: string, secret: string) {
  return b64url(createHmac("sha256", secret).update(data).digest());
}

export function createToken(username: string, secret: string) {
  const payload = b64url(
    JSON.stringify({ u: username, exp: Math.floor(Date.now() / 1000) + MAX_AGE }),
  );
  return `${payload}.${sign(payload, secret)}`;
}

export function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyToken(token: string | null, secret: string) {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  if (!payload) return null;
  const expected = sign(payload, secret);
  const a = Buffer.from(sig || "");
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const json = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(),
    ) as { u: string; exp: number };
    if (!json.exp || json.exp < Math.floor(Date.now() / 1000)) return null;
    return json;
  } catch {
    return null;
  }
}

export function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function getSession(request: Request) {
  const secret = process.env["ADMIN_SECRET"];
  if (!secret) return null;
  return verifyToken(readCookie(request, COOKIE_NAME), secret);
}
