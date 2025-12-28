-- Create storage bucket for journal images if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('journal-images', 'journal-images', true, 5242880) -- 5MB limit
ON CONFLICT (id) DO NOTHING;

-- Set up security policies for the journal images bucket
-- Allow public read access (since images are embedded in the journal entries)
CREATE POLICY "Journal Images Public Read Access" 
ON storage.objects FOR SELECT
USING (bucket_id = 'journal-images');

-- Only authenticated users can insert their own images
CREATE POLICY "Users Can Upload Their Own Journal Images" 
ON storage.objects FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'journal-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Users can update and delete their own images
CREATE POLICY "Users Can Manage Their Own Journal Images" 
ON storage.objects FOR UPDATE 
TO authenticated
USING (bucket_id = 'journal-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users Can Delete Their Own Journal Images" 
ON storage.objects FOR DELETE 
TO authenticated
USING (bucket_id = 'journal-images' AND (storage.foldername(name))[1] = auth.uid()::text); 