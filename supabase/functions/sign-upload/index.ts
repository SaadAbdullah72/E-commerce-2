// Signs a Cloudinary upload. The API secret never leaves this function.
//   - folders products / categories / banners: ADMINS only (as before)
//   - folder reviews: a signed-in CUSTOMER who has bought something. The database
//     (reserve_review_upload, migration 0013) decides, applies the limit of 10 uploads per hour and
//     chooses the file's public_id; this function only signs what the database approved.
// Deployed by pasting into Supabase Dashboard -> Edge Functions (name: sign-upload, JWT verification ON).
import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set([
  'https://e-commerce-2-hazel.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
]);
const FOLDERS = new Set(['products', 'categories', 'banners']);
const ALLOWED_FORMATS = 'jpg,jpeg,png,webp';
// Review uploads. The size limits (photo 5 MB, video 10 MB) are checked in the browser and again
// by submit_review(); Cloudinary's own account limits are the hard stop.
const REVIEW_FORMATS: Record<string, string> = { photo: ALLOWED_FORMATS, video: 'mp4,webm' };
// An incoming transformation: the stored photo is at most 2000 px wide/high, and Cloudinary drops
// the camera metadata (EXIF, including GPS) when it applies a transformation.
const REVIEW_PHOTO_TRANSFORMATION = 'c_limit,w_2000,h_2000';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const REVIEW_PUBLIC_ID = /^shopyaro\/reviews\/[0-9a-f-]{36}\/(photo|video)\/[A-Za-z0-9_-]+$/;
const MAX_SIGNATURES_PER_MINUTE = 30;

// Best-effort limit (memory is per function instance, so this is a brake, not a guarantee).
const recent = new Map<string, number[]>();

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function reply(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

function tooMany(userId: string) {
  const now = Date.now();
  const hits = (recent.get(userId) ?? []).filter((time) => now - time < 60_000);
  hits.push(now);
  recent.set(userId, hits);
  return hits.length > MAX_SIGNATURES_PER_MINUTE;
}

async function sha1Hex(text: string) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin');

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405, origin);
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return reply({ error: 'Forbidden' }, 403, origin);

  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
  const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
  const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!cloudName || !apiKey || !apiSecret || !supabaseUrl || !anonKey) {
    return reply({ error: 'Uploads are not configured' }, 500, origin);
  }

  // Who is calling? Checked with the caller's own token (admin rights are checked below, for admin folders).
  const authorization = request.headers.get('Authorization') ?? '';
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return reply({ error: 'Not signed in' }, 401, origin);

  let body: { folder?: unknown; reviewId?: unknown; kind?: unknown } | null;
  try {
    body = await request.json();
  } catch {
    return reply({ error: 'Invalid request' }, 400, origin);
  }
  const folder = body?.folder;

  // Same brake for everyone (the database applies the real per-hour limit for reviews).
  if (tooMany(userData.user.id)) return reply({ error: 'Too many requests' }, 429, origin);

  let assetFolder: string;
  let publicId: string;
  let allowedFormats: string;
  let resourceType: 'image' | 'video' = 'image';
  let transformation: string | null = null;

  if (folder === 'reviews') {
    // ---- a customer's review photo or video ----
    const reviewId = body?.reviewId;
    const kind = body?.kind;
    if (typeof reviewId !== 'string' || !UUID.test(reviewId)) {
      return reply({ error: 'Invalid review' }, 400, origin);
    }
    if (typeof kind !== 'string' || !(kind in REVIEW_FORMATS)) {
      return reply({ error: 'Invalid kind' }, 400, origin);
    }

    const { data: reserved, error: reserveError } = await supabase.rpc('reserve_review_upload', {
      p_review_id: reviewId,
      p_kind: kind,
    });
    if (reserveError) {
      const reason = reserveError.message;
      if (reason === 'rate_limited') return reply({ error: 'Too many uploads. Try again later.' }, 429, origin);
      if (reason === 'not_purchased') return reply({ error: 'Only customers can add review media' }, 403, origin);
      if (reason === 'review_not_found') return reply({ error: 'Review not found' }, 404, origin);
      if (reason === 'invalid_kind') return reply({ error: 'Invalid kind' }, 400, origin);
      return reply({ error: 'Could not prepare the upload' }, 500, origin);
    }
    if (typeof reserved !== 'string' || !REVIEW_PUBLIC_ID.test(reserved)) {
      return reply({ error: 'Could not prepare the upload' }, 500, origin);
    }

    publicId = reserved;
    assetFolder = reserved.slice(0, reserved.lastIndexOf('/'));
    allowedFormats = REVIEW_FORMATS[kind];
    if (kind === 'video') resourceType = 'video';
    else transformation = REVIEW_PHOTO_TRANSFORMATION;
  } else {
    // ---- an admin's catalog picture ----
    const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin');
    if (adminError || isAdmin !== true) return reply({ error: 'Not allowed' }, 403, origin);

    if (typeof folder !== 'string' || !FOLDERS.has(folder)) {
      return reply({ error: 'Invalid folder' }, 400, origin);
    }
    // The server decides the file name and place, so the browser cannot pick another path.
    assetFolder = `shopyaro/${folder}`;
    publicId = `${assetFolder}/${crypto.randomUUID()}`;
    allowedFormats = ALLOWED_FORMATS;
  }

  const timestamp = Math.floor(Date.now() / 1000);

  // Cloudinary signing: sorted "key=value" pairs joined by "&", then the secret appended.
  const toSign: Record<string, string> = {
    allowed_formats: allowedFormats,
    asset_folder: assetFolder,
    public_id: publicId,
    timestamp: String(timestamp),
  };
  if (transformation) toSign.transformation = transformation;
  const stringToSign = Object.entries(toSign)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  const signature = await sha1Hex(stringToSign + apiSecret);

  return reply(
    {
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
      apiKey,
      timestamp,
      signature,
      publicId,
      assetFolder,
      allowedFormats,
      resourceType,
      transformation,
    },
    200,
    origin,
  );
});
