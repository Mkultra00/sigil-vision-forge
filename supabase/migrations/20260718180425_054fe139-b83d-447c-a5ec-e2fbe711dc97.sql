
-- Per-user folder policies: first path segment must equal the user's uid
CREATE POLICY "uploads own read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "uploads own write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "uploads own delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "visions own read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'visions' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "visions own write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'visions' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "sigils own read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'sigils' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "sigils own write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sigils' AND (storage.foldername(name))[1] = auth.uid()::text);
