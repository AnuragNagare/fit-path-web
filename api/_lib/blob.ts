import { del, head } from '@vercel/blob';

// Thin wrappers so the rest of the code (and the tests) deal with one small interface.

export type BlobInfo = { size: number; contentType: string };

// Size and type of a file already uploaded to our Blob store, or null if it is not there.
export async function blobInfo(url: string): Promise<BlobInfo | null> {
  try {
    const info = await head(url);
    return { size: info.size, contentType: info.contentType };
  } catch {
    return null;
  }
}

// Removes files from the store. A failure only leaves an unused file behind, so it is logged, not raised.
export async function deleteBlobs(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  try {
    await del(urls);
  } catch (err) {
    console.error('blob delete failed', err instanceof Error ? err.message : err);
  }
}
