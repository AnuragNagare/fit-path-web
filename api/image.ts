import { rows } from './_lib/db.js';
import { isUuid } from './_lib/validate.js';
import { queryParam, type ApiRequest, type ApiResponse } from './_lib/http.js';

// GET /api/image?id=<uuid>  ->  the gym photo (public: shown in <img> tags, which cannot send a token)
export default async function handler(req: ApiRequest, res: ApiResponse) {
  const id = queryParam(req, 'id');
  if (!isUuid(id)) return res.status(400).json({ error: 'Invalid image id.' });

  try {
    const [image] = await rows<{ content_type: string; b64: string }>(
      "SELECT content_type, encode(data, 'base64') AS b64 FROM gym_images WHERE id = $1",
      [id],
    );
    if (!image) return res.status(404).json({ error: 'Image not found.' });
    res.setHeader('Content-Type', image.content_type);
    // Image bytes never change for an id (a replaced photo gets a new id).
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.status(200).send(Buffer.from(image.b64, 'base64'));
  } catch {
    res.status(502).json({ error: 'Image unavailable.' });
  }
}
