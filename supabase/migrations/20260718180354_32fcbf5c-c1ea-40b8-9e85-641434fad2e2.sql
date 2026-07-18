
-- Symbol corpus (public read)
CREATE TABLE public.symbols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system text NOT NULL CHECK (system IN ('tarot','iching')),
  code text NOT NULL,
  name text NOT NULL,
  arcana text,
  suit text,
  number int,
  keywords text[] NOT NULL DEFAULT '{}',
  upright_text text NOT NULL,
  reversed_text text,
  changing_text jsonb,
  image_url text,
  UNIQUE (system, code)
);
GRANT SELECT ON public.symbols TO anon, authenticated;
GRANT ALL ON public.symbols TO service_role;
ALTER TABLE public.symbols ENABLE ROW LEVEL SECURITY;
CREATE POLICY "symbols public read" ON public.symbols FOR SELECT USING (true);

-- Spreads (public read)
CREATE TABLE public.spreads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system text NOT NULL,
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  positions jsonb NOT NULL
);
GRANT SELECT ON public.spreads TO anon, authenticated;
GRANT ALL ON public.spreads TO service_role;
ALTER TABLE public.spreads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spreads public read" ON public.spreads FOR SELECT USING (true);

-- Sessions
CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  el_conversation_id text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions own" ON public.sessions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Readings
CREATE TABLE public.readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.sessions ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  system text NOT NULL,
  spread_slug text NOT NULL,
  question text,
  rng_seed text NOT NULL,
  rng_method text NOT NULL DEFAULT 'crypto',
  drawn jsonb NOT NULL,
  transcript text,
  closing_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.readings TO authenticated;
GRANT ALL ON public.readings TO service_role;
ALTER TABLE public.readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "readings own" ON public.readings FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX readings_user_created_idx ON public.readings (user_id, created_at DESC);

-- Uploads (offerings)
CREATE TABLE public.uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.sessions ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('image','document')),
  storage_path text NOT NULL,
  mime_type text,
  filename text,
  extracted_text text,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uploads TO authenticated;
GRANT ALL ON public.uploads TO service_role;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uploads own" ON public.uploads FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Visions
CREATE TABLE public.visions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_id uuid REFERENCES public.readings ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  prompt text NOT NULL,
  storage_path text NOT NULL,
  model text DEFAULT 'openai/gpt-image-2',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visions TO authenticated;
GRANT ALL ON public.visions TO service_role;
ALTER TABLE public.visions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visions own" ON public.visions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Sigils
CREATE TABLE public.sigils (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  source_upload_id uuid REFERENCES public.uploads ON DELETE SET NULL,
  intent text NOT NULL,
  statement text NOT NULL,
  letters_reduced text NOT NULL,
  svg text NOT NULL,
  storage_path text,
  prompt text,
  model text DEFAULT 'google/gemini-3.1-flash-image',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sigils TO authenticated;
GRANT ALL ON public.sigils TO service_role;
ALTER TABLE public.sigils ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sigils own" ON public.sigils FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX sigils_user_created_idx ON public.sigils (user_id, created_at DESC);
