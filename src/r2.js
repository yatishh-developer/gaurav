/* ═══════════════════════════════════════════════════
   CONFIG — replace with your actual values
═══════════════════════════════════════════════════ */
export const CONFIG = {
  accountId:       'YOUR_CLOUDFLARE_ACCOUNT_ID',
  bucketName:      'YOUR_BUCKET_NAME',
  accessKeyId:     'YOUR_R2_ACCESS_KEY_ID',
  secretAccessKey: 'YOUR_R2_SECRET_ACCESS_KEY',
  region:          'auto',
};

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp']);

export function isImage(key) {
  return IMAGE_EXTS.has(key.split('.').pop().toLowerCase());
}

const endpoint = `https://${CONFIG.accountId}.r2.cloudflarestorage.com`;

/* ── Crypto helpers ── */
async function hmacSHA256(key, data) {
  const k = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

async function sha256Hex(data) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return toHex(buf);
}

function toHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function isoDate(d) {
  return d.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
}

function dateStamp(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

async function getSigningKey(dateStr) {
  const kDate    = await hmacSHA256('AWS4' + CONFIG.secretAccessKey, dateStr);
  const kRegion  = await hmacSHA256(kDate, CONFIG.region);
  const kService = await hmacSHA256(kRegion, 's3');
  return hmacSHA256(kService, 'aws4_request');
}

async function signRequest({ method, url, body = '' }) {
  const u = new URL(url);
  const now = new Date();
  const amzDate = isoDate(now);
  const dStamp  = dateStamp(now);
  const headers = {
    'x-amz-date': amzDate,
    'x-amz-content-sha256': await sha256Hex(body),
    'host': u.host,
  };

  const signedHeaderNames = Object.keys(headers).map(h => h.toLowerCase()).sort();
  const canonicalHeaders  = signedHeaderNames
    .map(h => `${h}:${headers[Object.keys(headers).find(k => k.toLowerCase() === h)].trim()}\n`)
    .join('');
  const signedHeadersStr  = signedHeaderNames.join(';');

  const canonicalQS = [...u.searchParams.entries()]
    .sort(([a], [b]) => a < b ? -1 : 1)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const canonicalRequest = [
    method, u.pathname, canonicalQS,
    canonicalHeaders, signedHeadersStr,
    headers['x-amz-content-sha256'],
  ].join('\n');

  const credScope = `${dStamp}/${CONFIG.region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256', amzDate, credScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = await getSigningKey(dStamp);
  const signature  = toHex(await hmacSHA256(signingKey, stringToSign));

  headers['Authorization'] =
    `AWS4-HMAC-SHA256 Credential=${CONFIG.accessKeyId}/${credScope}, ` +
    `SignedHeaders=${signedHeadersStr}, Signature=${signature}`;

  return headers;
}

/* ── Pre-signed GET URL (1 hour) ── */
export async function presignUrl(key) {
  const expires = 3600;
  const now     = new Date();
  const amzDate = isoDate(now);
  const dStamp  = dateStamp(now);
  const credScope = `${dStamp}/${CONFIG.region}/s3/aws4_request`;

  const u = new URL(`${endpoint}/${CONFIG.bucketName}/${encodeURIComponent(key)}`);
  u.searchParams.set('X-Amz-Algorithm',    'AWS4-HMAC-SHA256');
  u.searchParams.set('X-Amz-Credential',   `${CONFIG.accessKeyId}/${credScope}`);
  u.searchParams.set('X-Amz-Date',          amzDate);
  u.searchParams.set('X-Amz-Expires',       String(expires));
  u.searchParams.set('X-Amz-SignedHeaders', 'host');

  const canonicalQS = [...u.searchParams.entries()]
    .sort(([a], [b]) => a < b ? -1 : 1)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const canonicalRequest = [
    'GET',
    `/${CONFIG.bucketName}/${encodeURIComponent(key)}`,
    canonicalQS,
    `host:${new URL(endpoint).host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256', amzDate, credScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = await getSigningKey(dStamp);
  const signature  = toHex(await hmacSHA256(signingKey, stringToSign));

  u.searchParams.set('X-Amz-Signature', signature);
  return u.toString();
}

/* ── List all objects (paginated) ── */
export async function listAllObjects() {
  const keys = [];
  let continuationToken = null;

  do {
    const url = new URL(`${endpoint}/${CONFIG.bucketName}`);
    url.searchParams.set('list-type', '2');
    url.searchParams.set('max-keys',  '1000');
    if (continuationToken) url.searchParams.set('continuation-token', continuationToken);

    const headers = await signRequest({ method: 'GET', url: url.toString() });
    const res = await fetch(url.toString(), { headers });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`ListObjects failed: ${res.status} — ${txt}`);
    }

    const doc = new DOMParser().parseFromString(await res.text(), 'application/xml');
    doc.querySelectorAll('Contents > Key').forEach(el => keys.push(el.textContent));

    const isTruncated = doc.querySelector('IsTruncated')?.textContent === 'true';
    continuationToken = isTruncated
      ? doc.querySelector('NextContinuationToken')?.textContent
      : null;
  } while (continuationToken);

  return keys;
}
