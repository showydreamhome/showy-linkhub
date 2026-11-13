import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

import { GALLERY_CATEGORIES } from "./public/gallery-categories.js";

const publicDir = fileURLToPath(new URL("./public/", import.meta.url));
const dataDir = resolve(process.env.DATA_DIR || fileURLToPath(new URL("./data/", import.meta.url)));
const uploadDir = join(dataDir, "uploads");
const uploadPath = /^\/uploads\/([0-9a-f-]{36}\.(?:jpg|png|webp))$/;
const imageTypes = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const enquiriesFile = join(dataDir, "enquiries.jsonl");
const contentFile = join(dataDir, "content.json");
const defaults = JSON.parse(readFileSync(join(publicDir, "content.json"), "utf8"));
const password = process.env.ADMIN_PASSWORD;
if (password && password.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters.");

const hash = (value) => createHash("sha256").update(value).digest();
const passwordHash = password && hash(`Bearer ${password}`);
const attempts = new Map();
const enquiryAttempts = new Map();
const staticTypes = {
  "index.html": "text/html", "admin.html": "text/html",
  "styles.css": "text/css", "styles-v2.css": "text/css", "gallery.css": "text/css",
  "admin.css": "text/css", "script.js": "text/javascript", "admin.js": "text/javascript",
  "gallery-covers.jpg": "image/jpeg",
  "gallery-categories.js": "text/javascript", "content.json": "application/json", "hero-interior.png": "image/png", "showy-mark.png": "image/png"
};

function currentContent() {
  try {
    const content = JSON.parse(readFileSync(contentFile, "utf8"));
    content.gallery = content.gallery.map((photo) => ({ category: "living", ...photo }));
    return { ...content, stats: { ...defaults.stats, ...content.stats }, contact: { ...defaults.contact, ...content.contact } };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { ...defaults, revision: 0 };
  }
}

function field(value, max) {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error("Check the required fields and length limits.");
  }
  return value.trim();
}

function webUrl(value) {
  const address = field(value, 2048);
  const url = new URL(address);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Use a valid HTTP or HTTPS URL.");
  }
  return url.href;
}

function stat(value, key) {
  const rating = key === "rating";
  if (!Number.isFinite(value) || value < 0 || value > (rating ? 5 : 999999)
      || !Number.isInteger(rating ? value * 10 : value)) {
    throw new Error("Enter whole project and experience numbers and a rating from 0 to 5 with at most one decimal.");
  }
  return value;
}

function readEnquiries() {
  if (!existsSync(enquiriesFile)) return [];
  return readFileSync(enquiriesFile, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)).reverse();
}

function validate(data, current) {
  const links = {};
  for (const key of Object.keys(defaults.links)) {
    if (key === "phone") {
      const phone = field(data.links[key], 60);
      if (!/^tel:\+?[0-9 ()-]{5,32}$/.test(phone)) throw new Error("Use a tel: phone link.");
      links[key] = phone.replace(/[ ()-]/g, "");
    } else {
      links[key] = webUrl(data.links[key]);
    }
  }
  if (!Array.isArray(data.gallery) || data.gallery.length > 30) {
    throw new Error("The gallery supports up to 30 photos.");
  }
  return {
    links,
    stats: Object.fromEntries(Object.keys(defaults.stats).map((key) => [key, stat(data.stats?.[key] ?? current.stats[key], key)])),
    contact: Object.fromEntries(Object.keys(defaults.contact).map((key) => [key, field(data.contact?.[key] ?? current.contact[key], 400)])),
    headline: field(data.headline, 80),
    highlight: field(data.highlight, 80),
    intro: field(data.intro, 300),
    gallery: data.gallery.map(({ src, title, alt, category = "living" }) => {
      if (!Object.hasOwn(GALLERY_CATEGORIES, category)) throw new Error("Select a gallery category.");
      const upload = typeof src === "string" && src.match(uploadPath);
      if (upload && !existsSync(join(uploadDir, upload[1]))) throw new Error("Upload the missing photo again.");
      return {
        src: upload || src === "hero-interior.png" ? src : webUrl(src),
        title: field(title, 100),
        alt: field(alt, 180),
        category
      };
    })
  };
}

function json(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(value));
}

async function readBody(req, limit) {
  if (Number(req.headers["content-length"]) > limit) {
    req.resume();
    return null;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > limit) {
      req.resume();
      return null;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function imageExtension(bytes) {
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "jpg";
  if (bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) return "png";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

const server = createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  const pathname = req.url.split("?")[0];
  try {
    if (pathname === "/api/content" && req.method === "GET") {
      return json(res, 200, currentContent());
    }
    if (pathname === "/api/enquiries" && req.method === "POST") {
      if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] || "")) {
        return json(res, 415, { error: "Expected JSON." });
      }
      const ip = req.socket.remoteAddress;
      const now = Date.now();
      for (const [address, attempt] of enquiryAttempts) {
        if (attempt.until <= now) enquiryAttempts.delete(address);
      }
      const attempt = enquiryAttempts.get(ip) || { count: 0, until: now + 60_000 };
      if (attempt.count >= 10) return json(res, 429, { error: "Please wait a minute before submitting again." });
      attempt.count += 1;
      enquiryAttempts.set(ip, attempt);

      const body = await readBody(req, 4096);
      if (!body) return json(res, 413, { error: "The enquiry is too large." });
      let enquiry;
      try {
        const data = JSON.parse(body);
        const phone = field(data.phone, 30);
        if (!/^\+?[0-9 ().-]+$/.test(phone) || !/^\d{7,15}$/.test(phone.replace(/[^0-9]/g, ""))) {
          throw new Error("Invalid phone number.");
        }
        enquiry = {
          receivedAt: new Date().toISOString(),
          name: field(data.name, 100),
          phone,
          project: field(data.project, 100),
          city: data.city == null || (typeof data.city === "string" && !data.city.trim()) ? "" : field(data.city, 100)
        };
      } catch {
        return json(res, 400, { error: "Check your name, phone number and project details." });
      }
      mkdirSync(dataDir, { recursive: true, mode: 0o700 });
      appendFileSync(enquiriesFile, JSON.stringify(enquiry) + "\n", { mode: 0o600 });
      return json(res, 201, { saved: true });
    }
    const inbox = pathname === "/api/admin/enquiries" && req.method === "GET";
    const uploading = pathname === "/api/admin/upload" && req.method === "POST";
    if (inbox || uploading || (pathname === "/api/admin" && ["GET", "PUT"].includes(req.method))) {
      if (!passwordHash) return json(res, 503, { error: "Set ADMIN_PASSWORD on the server to enable editing." });
      const ip = req.socket.remoteAddress;
      const now = Date.now();
      for (const [address, attempt] of attempts) {
        if (attempt.until <= now) attempts.delete(address);
      }
      if ((attempts.get(ip)?.count || 0) >= 10) {
        return json(res, 429, { error: "Wait a minute before trying again." });
      }
      if (!timingSafeEqual(hash(req.headers.authorization || ""), passwordHash)) {
        const attempt = attempts.get(ip) || { count: 0, until: now + 60_000 };
        attempt.count += 1;
        attempts.set(ip, attempt);
        return json(res, 401, { error: "Incorrect admin password." });
      }
      attempts.delete(ip);
      if (inbox) return json(res, 200, readEnquiries());
      if (uploading) {
        if (!Object.values(imageTypes).includes(req.headers["content-type"])) {
          return json(res, 415, { error: "Choose a JPG, PNG, or WebP image." });
        }
        const bytes = await readBody(req, 10 * 1024 * 1024);
        if (!bytes) return json(res, 413, { error: "Each photo must be 10 MB or smaller." });
        const ext = imageExtension(bytes);
        if (!ext || imageTypes[ext] !== req.headers["content-type"]) {
          return json(res, 415, { error: "This file does not match its image format." });
        }
        const filename = `${randomUUID()}.${ext}`;
        mkdirSync(uploadDir, { recursive: true });
        writeFileSync(join(uploadDir, filename), bytes, { flag: "wx" });
        return json(res, 201, { src: `/uploads/${filename}` });
      }
      if (req.method === "GET") return json(res, 200, currentContent());
      if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] || "")) {
        return json(res, 415, { error: "Expected JSON." });
      }
      const body = await readBody(req, 256 * 1024);
      if (!body) return json(res, 413, { error: "This update is too large." });
      const current = currentContent();
      let data, next;
      try {
        data = JSON.parse(body);
        next = validate(data, current);
      } catch (error) {
        const message = error instanceof SyntaxError || error instanceof TypeError ? "Check the form values and image URLs." : error.message;
        return json(res, 400, { error: message });
      }
      const { revision } = current;
      if (data.revision !== revision) {
        return json(res, 409, { error: "Someone published newer changes. Sign in again to load the latest version." });
      }
      next.revision = revision + 1;
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(`${contentFile}.tmp`, JSON.stringify(next, null, 2));
      renameSync(`${contentFile}.tmp`, contentFile);
      return json(res, 200, next);
    }

    const upload = pathname.match(uploadPath);
    if (upload && ["GET", "HEAD"].includes(req.method)) {
      const path = join(uploadDir, upload[1]);
      if (!existsSync(path)) return json(res, 404, { error: "Photo not found." });
      const body = readFileSync(path);
      res.writeHead(200, {
        "Content-Type": imageTypes[upload[1].split(".").pop()],
        "Content-Length": body.length,
        "Cache-Control": "public, max-age=86400"
      });
      return res.end(req.method === "HEAD" ? undefined : body);
    }

    const file = pathname === "/" ? "index.html" : pathname === "/admin" ? "admin.html" : pathname.slice(1);
    if (["GET", "HEAD"].includes(req.method) && Object.hasOwn(staticTypes, file)) {
      const body = readFileSync(join(publicDir, file));
      res.writeHead(200, { "Content-Type": staticTypes[file], "Content-Length": body.length });
      return res.end(req.method === "HEAD" ? undefined : body);
    }
    json(res, 404, { error: "Page not found." });
  } catch (error) {
    console.error(error);
    if (!res.headersSent) json(res, 500, { error: "The server could not complete the request." });
  }
});

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
server.listen(port, host, () => console.log(`Showy Link Hub listening on http://${host}:${server.address().port}`));
