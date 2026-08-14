const MAX = 50;

const globalStore = globalThis;

if (!globalStore.__rr_announcements) {
  globalStore.__rr_announcements = [];
}

const store = globalStore.__rr_announcements;

function readCookie(req, name) {
  const header = req.headers.cookie || "";

  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");

    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return null;
}

function getSession(req) {
  const secret = process.env.ADMIN_SECRET;

  if (!secret) return null;

  const token = readCookie(req, "rr_admin");

  if (!token || !token.includes(".")) return null;

  return token;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString() || "{}");
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    // PUBLIC: get announcements
    if (req.method === "GET") {
      return res.status(200).json({
        announcements: store,
      });
    }

    // ADMIN only
    if (!getSession(req)) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    // ADMIN: create announcement
    if (req.method === "POST") {
      const body = await readBody(req);

      const title = (body.title || "").trim();
      const text = (body.body || "").trim();

      if (!title || !text) {
        return res.status(400).json({
          error: "Title and body are required.",
        });
      }

      if (title.length > 160 || text.length > 4000) {
        return res.status(400).json({
          error: "Title or body is too long.",
        });
      }

      const announcement = {
        id:
          Date.now().toString(36) +
          "-" +
          Math.random().toString(36).slice(2, 8),

        title,

        body: text,

        pinned: !!body.pinned,

        created_at: new Date().toISOString(),
      };

      store.unshift(announcement);

      if (store.length > MAX) {
        store.length = MAX;
      }

      return res.status(200).json({
        ok: true,
        announcement,
      });
    }

    // ADMIN: delete announcement
    if (req.method === "DELETE") {
      const url = new URL(
        req.url,
        "http://localhost"
      );

      const id = url.searchParams.get("id");

      if (!id) {
        return res.status(400).json({
          error: "Missing id.",
        });
      }

      const index = store.findIndex(
        (item) => item.id === id
      );

      if (index === -1) {
        return res.status(404).json({
          error: "Announcement not found.",
        });
      }

      store.splice(index, 1);

      return res.status(200).json({
        ok: true,
      });
    }

    return res.status(405).json({
      error: "Method not allowed",
    });
  } catch (error) {
    console.error("Announcements API error:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "Server error.",
    });
  }
}