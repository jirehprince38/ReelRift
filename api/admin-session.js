/* =========================================================
   Returns whether the current request has a valid admin
   session (based on the signed HttpOnly cookie).
   ========================================================= */
const { getSession } = require("./_auth");

module.exports = async function handler(req, res) {
  const session = getSession(req);
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ loggedIn: !!session });
};
