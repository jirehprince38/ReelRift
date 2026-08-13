import { createFileRoute } from "@tanstack/react-router";
import { getSession } from "@/lib/admin-auth.server";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const CATEGORIES = ["general", "broken_video", "wrong_title", "bug", "request"];

export const Route = createFileRoute("/api/public/reports")({
  server: {
    handlers: {
      // Public: submit a report to the admin.
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          name?: string;
          email?: string;
          category?: string;
          message?: string;
        };
        const message = (body.message || "").trim();
        if (message.length < 5) return json({ error: "Please describe the issue." }, 400);
        if (message.length > 4000) return json({ error: "Message is too long." }, 400);
        const email = (body.email || "").trim();
        if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
          return json({ error: "Please enter a valid email address." }, 400);
        const category = CATEGORIES.includes(body.category || "") ? body.category! : "general";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("reports").insert({
          name: (body.name || "").trim().slice(0, 120) || null,
          email: email.slice(0, 160) || null,
          category,
          message,
        });
        if (error) return json({ error: "Could not send your report. Please try again." }, 500);
        return json({ ok: true });
      },
      // Admin only.
      GET: async ({ request }) => {
        if (!getSession(request)) return json({ error: "Unauthorized" }, 401);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("reports")
          .select("id,name,email,category,message,handled,created_at")
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) return json({ error: "Could not load reports." }, 500);
        return json({ reports: data ?? [] });
      },
      PATCH: async ({ request }) => {
        if (!getSession(request)) return json({ error: "Unauthorized" }, 401);
        const body = (await request.json().catch(() => ({}))) as {
          id?: string;
          handled?: boolean;
        };
        if (!body.id) return json({ error: "Missing id." }, 400);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("reports")
          .update({ handled: !!body.handled })
          .eq("id", body.id);
        if (error) return json({ error: "Could not update the report." }, 500);
        return json({ ok: true });
      },
      DELETE: async ({ request }) => {
        if (!getSession(request)) return json({ error: "Unauthorized" }, 401);
        const id = new URL(request.url).searchParams.get("id");
        if (!id) return json({ error: "Missing id." }, 400);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("reports").delete().eq("id", id);
        if (error) return json({ error: "Could not delete the report." }, 500);
        return json({ ok: true });
      },
    },
  },
});
