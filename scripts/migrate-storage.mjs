import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { cloud, galleryUrl, loadSite, saveSite, saveEnquiry, uploadImage } from "../supabase-store.mjs";

if (!cloud) throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY before migrating.");
const dir = resolve(process.env.DATA_DIR || "data");
const content = JSON.parse(readFileSync(join(dir, "content.json"), "utf8"));
const imageTypes = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const uploads = new Map();
for (const photo of content.gallery) {
  if (!photo.src.startsWith("/uploads/")) continue;
  const match = photo.src.match(/^\/uploads\/([a-f0-9-]{36}\.(jpg|png|webp))$/);
  if (!match) throw new Error("Unexpected gallery upload path.");
  const [, filename, extension] = match;
  uploads.set(filename, { bytes: readFileSync(join(dir, "uploads", filename)), mime: imageTypes[extension] });
  photo.src = galleryUrl(filename);
}
const enquiryFile = join(dir, "enquiries.jsonl");
const enquiries = existsSync(enquiryFile)
  ? readFileSync(enquiryFile, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line))
  : [];

const existing = await loadSite();
content.revision = Math.max(1, content.revision || 0);
if (existing && JSON.stringify(existing.gallery) !== JSON.stringify(content.gallery)) {
  // Compare JSON objects without relying on Postgres JSONB property order.
  const normalize = (value) => JSON.stringify(value.map(({ src, title, alt, category }) => [src, title, alt, category]));
  if (normalize(existing.gallery) !== normalize(content.gallery)) {
    throw new Error("Supabase already contains a different gallery. Existing content was preserved.");
  }
}
for (const [filename, { bytes, mime }] of uploads) await uploadImage(filename, bytes, mime, true);
if (!existing && !(await saveSite(content, 0))) throw new Error("Another process published content during migration.");
for (const enquiry of enquiries) {
  const id = createHash("sha256").update(JSON.stringify(enquiry)).digest("hex");
  await saveEnquiry(`enquiry-import-${id}`, enquiry);
}
console.log(`Migrated ${uploads.size} image files and ${enquiries.length} enquiries. Verified the published site record: ${Boolean(await loadSite())}.`);
