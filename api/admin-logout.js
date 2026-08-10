/* =========================================================
   Clears the admin session cookie.
   ========================================================= */
const { COOKIE_NAME } = require("./_auth");

module.exports = async function handler(req, res) {
  res.setHeader(
    "Set-Cookie",
    COOKIE_NAME + "=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0"
  );
  res.status(200).json({ ok: true });
};
