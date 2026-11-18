// Removes unused pictures and videos from Cloudinary. It works ONLY from the database queue
// (cloudinary_cleanup_queue, migrations 0007 and 0013): the browser sends no public_ids, so a caller
// can never ask for an arbitrary file to be deleted. The API secret never leaves this function.
// Any signed-in user may trigger a run (a customer deleting their own review queues files that
// must go too); it can only drain the queue, it cannot choose what is deleted, and it is rate limited.
// Deployed by pasting into Supabase Dashboard -> Edge Functions (name: delete-assets, JWT verification ON).
import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set([
  'https://e-commerce-2-hazel.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
]);
// Same shape the database enforces on the queue; checked again here as a second lock.
const PUBLIC_ID_PATTERN =
  /^(shopyaro\/(products|categories|banners)\/[A-Za-z0-9_-]+|shopyaro\/reviews\/[0-9a-f-]{36}\/(photo|video)\/[A-Za-z0-9_-]+)$/;
const BATCH_SIZE = 20;
const MAX_BATCHES = 5; // at most 100 pictures per call; the rest wait for the next call
const MAX_CALLS_PER_MINUTE = 20;

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
  return hits.length > MAX_CALLS_PER_MINUTE;
}

async function sha1Hex(text: string) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Ask Cloudinary to delete one picture or video. Returns null on success, or a short reason. */
async function destroy(
  publicId: string,
  resourceType: 'image' | 'video',
  cloudName: string,
  apiKey: string,
  apiSecret: string,
): Promise<string | null> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  // Cloudinary signing: sorted "key=value" pairs joined by "&", then the secret appended.
  const toSign = { invalidate: 'true', public_id: publicId, timestamp };
  const stringToSign = Object.entries(toSign)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  const signature = await sha1Hex(stringToSign + apiSecret);

  const form = new FormData();
  form.set('public_id', publicId);
  form.set('invalidate', 'true');
  form.set('timestamp', timestamp);
  form.set('api_key', apiKey);
  form.set('signature', signature);

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, {
      method: 'POST',
      body: form,
    });
    const body = await response.json().catch(() => null);
    // "not found" means it is already gone, which is exactly what we wanted.
    if (response.ok && (body?.result === 'ok' || body?.result === 'not found')) return null;
    return `Cloudinary said: ${body?.error?.message ?? body?.result ?? response.status}`;
  } catch {
    return 'Could not reach Cloudinary';
  }
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
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!cloudName || !apiKey || !apiSecret || !supabaseUrl || !anonKey || !serviceKey) {
    return reply({ error: 'Cleanup is not configured' }, 500, origin);
  }

  // Who is calling? Checked with the caller's own token.
  const authorization = request.headers.get('Authorization') ?? '';
  const asCaller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await asCaller.auth.getUser();
  if (userError || !userData.user) return reply({ error: 'Not signed in' }, 401, origin);

  if (tooMany(userData.user.id)) return reply({ error: 'Too many requests' }, 429, origin);

  // Only the queue functions are called with the service role; they are closed to browsers.
  const asService = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  let deleted = 0;
  let failed = 0;
  for (let round = 0; round < MAX_BATCHES; round++) {
    const { data: batch, error: claimError } = await asService.rpc('claim_cleanup_batch', {
      p_limit: BATCH_SIZE,
    });
    if (claimError) return reply({ error: 'Could not read the cleanup queue', deleted, failed }, 500, origin);
    if (!Array.isArray(batch) || batch.length === 0) break;

    const done: number[] = [];
    for (const item of batch as { id: number; public_id: string; resource_type?: string }[]) {
      const problem = PUBLIC_ID_PATTERN.test(item.public_id)
        ? await destroy(
            item.public_id,
            item.resource_type === 'video' ? 'video' : 'image',
            cloudName,
            apiKey,
            apiSecret,
          )
        : 'Not one of our upload paths';
      if (problem === null) {
        done.push(item.id);
      } else {
        failed++;
        await asService.rpc('fail_cleanup', { p_id: item.id, p_error: problem });
      }
    }
    if (done.length > 0) {
      const { error: completeError } = await asService.rpc('complete_cleanup', { p_ids: done });
      // If this fails the rows are retried later; deleting twice is harmless ("not found").
      if (!completeError) deleted += done.length;
    }
    if (batch.length < BATCH_SIZE) break;
  }

  return reply({ deleted, failed }, 200, origin);
});
