// Signs a Cloudinary upload for a signed-in ADMIN. The API secret never leaves this function.
// Deployed by pasting into Supabase Dashboard -> Edge Functions (name: sign-upload, JWT verification ON).
import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set([
  'https://e-commerce-2-hazel.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
]);
const FOLDERS = new Set(['products', 'categories', 'banners']);
const ALLOWED_FORMATS = 'jpg,jpeg,png,webp';
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

  // Who is calling, and are they an admin? Both are checked with the caller's own token.
  const authorization = request.headers.get('Authorization') ?? '';
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return reply({ error: 'Not signed in' }, 401, origin);

  const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin');
  if (adminError || isAdmin !== true) return reply({ error: 'Not allowed' }, 403, origin);

  if (tooMany(userData.user.id)) return reply({ error: 'Too many requests' }, 429, origin);

  let folder: unknown;
  try {
    folder = (await request.json())?.folder;
  } catch {
    return reply({ error: 'Invalid request' }, 400, origin);
  }
  if (typeof folder !== 'string' || !FOLDERS.has(folder)) {
    return reply({ error: 'Invalid folder' }, 400, origin);
  }

  // The server decides the file name and place, so the browser cannot pick another path.
  const assetFolder = `shopyaro/${folder}`;
  const publicId = `${assetFolder}/${crypto.randomUUID()}`;
  const timestamp = Math.floor(Date.now() / 1000);

  // Cloudinary signing: sorted "key=value" pairs joined by "&", then the secret appended.
  const toSign = {
    allowed_formats: ALLOWED_FORMATS,
    asset_folder: assetFolder,
    public_id: publicId,
    timestamp: String(timestamp),
  };
  const stringToSign = Object.entries(toSign)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  const signature = await sha1Hex(stringToSign + apiSecret);

  return reply(
    {
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      apiKey,
      timestamp,
      signature,
      publicId,
      assetFolder,
      allowedFormats: ALLOWED_FORMATS,
    },
    200,
    origin,
  );
});
