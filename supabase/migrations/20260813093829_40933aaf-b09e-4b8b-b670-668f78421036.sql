CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.announcements TO anon;
GRANT SELECT ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Announcements are public" ON public.announcements FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text,
  category text NOT NULL DEFAULT 'general',
  message text NOT NULL,
  handled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

INSERT INTO public.announcements (title, body, pinned) VALUES
  ('Welcome to ReelRift Updates', 'This page is where we post platform news, new features, and maintenance notices. Check back often.', true),
  ('Player servers improved', 'We refreshed our playback servers so more titles load on the first try. If a title still fails, switch servers on the watch page.', false),
  ('Report an issue', 'Found a broken title or a bug? Use the report form at the bottom of this page and it goes straight to our admin team.', false);