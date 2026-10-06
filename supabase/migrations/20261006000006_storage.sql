-- ==========================================
-- T6.1: STORAGE BUCKETS
-- ==========================================

-- Insertar buckets si no existen
INSERT INTO storage.buckets (id, name, public) VALUES ('posters', 'posters', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Politicas para posters
CREATE POLICY "Posters son publicos" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'posters');

CREATE POLICY "Solo admin inserta posters" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'posters' AND (auth.uid() IN (SELECT id FROM profiles WHERE rol = 'admin')));

CREATE POLICY "Solo admin actualiza posters" ON storage.objects
  FOR UPDATE
  WITH CHECK (bucket_id = 'posters' AND (auth.uid() IN (SELECT id FROM profiles WHERE rol = 'admin')));

-- Politicas para avatars
CREATE POLICY "Avatars son publicos" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Usuarios suben sus avatars" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid() = owner);

CREATE POLICY "Usuarios actualizan sus avatars" ON storage.objects
  FOR UPDATE
  WITH CHECK (bucket_id = 'avatars' AND auth.uid() = owner);
