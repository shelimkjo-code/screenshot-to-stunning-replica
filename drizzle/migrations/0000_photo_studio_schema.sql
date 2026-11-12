CREATE TABLE public.photo_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL DEFAULT '',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  photo_count integer NOT NULL DEFAULT 0,
  total_copies integer NOT NULL DEFAULT 0,
  page_count integer NOT NULL DEFAULT 0,
  files_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_jobs TO authenticated;
GRANT ALL ON public.photo_jobs TO service_role;
ALTER TABLE public.photo_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own jobs select" ON public.photo_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own jobs insert" ON public.photo_jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own jobs update" ON public.photo_jobs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own jobs delete" ON public.photo_jobs FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.job_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.photo_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  file_name text NOT NULL DEFAULT '',
  original_path text,
  enhanced_path text,
  cutout_path text,
  status text NOT NULL DEFAULT 'queued',
  enhance_status text NOT NULL DEFAULT 'pending',
  bg_status text NOT NULL DEFAULT 'pending',
  error text,
  copies integer NOT NULL DEFAULT 2,
  edits jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_photos_job_idx ON public.job_photos(job_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_photos TO authenticated;
GRANT ALL ON public.job_photos TO service_role;
ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own photos select" ON public.job_photos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own photos insert" ON public.job_photos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own photos update" ON public.job_photos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own photos delete" ON public.job_photos FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER photo_jobs_touch BEFORE UPDATE ON public.photo_jobs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER job_photos_touch BEFORE UPDATE ON public.job_photos FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "Own files select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own files insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own files update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own files delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);