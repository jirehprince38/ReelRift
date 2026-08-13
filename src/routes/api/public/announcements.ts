import { createFileRoute } from "@tanstack/react-router";
import { getSession } from "@/lib/admin-auth.server";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/api/public/announcements")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("announcements")
          .select("id,title,body,pinned,created_at")
          .order("pinned", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) return json({ error: "Could not load updates." }, 500);
        return json({ announcements: data ?? [] });
      },
      POST: async ({ request }) => {
        if (!getSession(request)) return json({ error: "Unauthorized" }, 401);
        const body = (await request.json().catch(() => ({}))) as {
          title?: string;
          body?: string;
          pinned?: boolean;
        };
        const title = (body.title || "").trim();
        const text = (body.body || "").trim();
        if (!title || !text) return json({ error: "Title and body are required." }, 400);
        if (title.length > 160 || text.length > 4000)
          return json({ error: "Title or body is too long." }, 400);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("announcements")
          .insert({ title, body: text, pinned: !!body.pinned });
        if (error) return json({ error: "Could not save the update." }, 500);
        return json({ ok: true });
      },
      DELETE: async ({ request }) => {
        if (!getSession(request)) return json({ error: "Unauthorized" }, 401);
        const id = new URL(request.url).searchParams.get("id");
        if (!id) return json({ error: "Missing id." }, 400);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("announcements").delete().eq("id", id);
        if (error) return json({ error: "Could not delete the update." }, 500);
        return json({ ok: true });
      },
    },
  },
});
