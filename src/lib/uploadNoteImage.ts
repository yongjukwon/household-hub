import { supabase } from '@/lib/supabase'

const BUCKET = 'note-images'
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

/**
 * Uploads an image for a Notes/blank page to the household-scoped Storage
 * bucket and returns its permanent public URL (stored inline in the Tiptap
 * doc). Path is `{householdId}/{uuid}.{ext}` — the household folder is what
 * the bucket's RLS insert policy checks, and the UUID keeps the object
 * unguessable. Throws on validation or upload failure.
 */
export async function uploadNoteImage(
  householdId: string,
  file: File,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files can be inserted.')
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Images must be 10 MB or smaller.')
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `${householdId}/${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
