import { getSession } from "./_auth.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ loggedIn: !!getSession(req) });
}
