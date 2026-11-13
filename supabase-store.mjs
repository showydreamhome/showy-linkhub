const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SECRET_KEY;
if ((base || key || process.env.VERCEL) && !(base && key)) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY for hosted storage.");
}

export const cloud = Boolean(base && key);
const bucket = "showy-gallery";
const rows = "/rest/v1/showy_content";
export const galleryUrl = (filename) => `${base}/storage/v1/object/public/${bucket}/${filename}`;

async function request(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("apikey", key);
  if (!key.startsWith("sb_")) headers.set("Authorization", `Bearer ${key}`);
  const response = await fetch(base + path, { ...options, headers, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Supabase request failed (${response.status}).`);
  return response;
}

async function writeRow(method, path, body, prefer) {
  return request(path, {
    method,
    headers: { "Content-Type": "application/json", Prefer: prefer },
    body: JSON.stringify(body)
  });
}

export async function loadSite() {
  const response = await request(`${rows}?content_key=eq.site&select=payload`);
  return (await response.json())[0]?.payload;
}

export async function saveSite(payload, revision) {
  if (revision === 0 && !(await loadSite())) {
    const response = await writeRow("POST", rows, { content_key: "site", payload }, "resolution=ignore-duplicates,return=representation");
    return (await response.json()).length === 1;
  }
  const response = await writeRow("PATCH", `${rows}?content_key=eq.site&payload->>revision=eq.${revision}`, { payload }, "return=representation");
  return (await response.json()).length === 1;
}

export async function loadEnquiries() {
  const response = await request(`${rows}?content_key=like.enquiry-*&select=payload&order=updated_at.desc&limit=1000`);
  return (await response.json()).map(({ payload }) => payload);
}

export async function saveEnquiry(contentKey, payload) {
  await writeRow("POST", rows, { content_key: contentKey, payload }, "resolution=ignore-duplicates,return=minimal");
}

export async function uploadImage(filename, bytes, mime, overwrite = false) {
  await request(`/storage/v1/object/${bucket}/${filename}`, {
    method: "POST",
    headers: { "Content-Type": mime, "x-upsert": String(overwrite) },
    body: bytes
  });
}
