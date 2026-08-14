const CATEGORIES = ["general", "broken_video", "wrong_title", "bug", "request"];

const MAX = 300;

// In-memory report storage.
// No Supabase/database required.
const globalStore = globalThis;

if (!globalStore.__rr_reports) {
  globalStore.__rr_reports = [];
}

const store = globalStore.__rr_reports;

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

  // Admin authentication is handled separately.
  // This endpoint only checks that the admin cookie exists.
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
    // PUBLIC: submit report
    if (req.method === "POST") {
      const body = await readBody(req);

      const message = (body.message || "").trim();

      if (message.length < 5) {
        return res.status(400).json({
          error: "Please describe the issue.",
        });
      }

      if (message.length > 4000) {
        return res.status(400).json({
          error: "Message is too long.",
        });
      }

      const email = (body.email || "").trim();

      if (
        email &&
        !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
      ) {
        return res.status(400).json({
          error: "Please enter a valid email address.",
        });
      }

      const category = CATEGORIES.includes(body.category || "")
        ? body.category
        : "general";

      const report = {
        id:
          Date.now().toString(36) +
          "-" +
          Math.random().toString(36).slice(2, 8),

        name:
          (body.name || "").trim().slice(0, 120) || null,

        email:
          email.slice(0, 160) || null,

        category,

        message,

        handled: false,

        created_at: new Date().toISOString(),
      };

      store.unshift(report);

      if (store.length > MAX) {
        store.length = MAX;
      }

      return res.status(200).json({
        ok: true,
      });
    }

    // ADMIN authentication
    if (!getSession(req)) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    // ADMIN: list reports
    if (req.method === "GET") {
      return res.status(200).json({
        reports: store,
      });
    }

    // ADMIN: mark handled/unhandled
    if (req.method === "PATCH") {
      const body = await readBody(req);

      if (!body.id) {
        return res.status(400).json({
          error: "Missing id.",
        });
      }

      const report = store.find(
        (item) => item.id === body.id
      );

      if (!report) {
        return res.status(404).json({
          error: "Report not found.",
        });
      }

      report.handled = !!body.handled;

      return res.status(200).json({
        ok: true,
      });
    }

    // ADMIN: delete report
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

      if (index !== -1) {
        store.splice(index, 1);
      }

      return res.status(200).json({
        ok: true,
      });
    }

    return res.status(405).json({
      error: "Method not allowed",
    });
  } catch (error) {
    console.error("Reports API error:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "Server error.",
    });
  }
}