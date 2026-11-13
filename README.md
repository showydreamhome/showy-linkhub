# Showy Link Hub

Run with Node.js 22 or newer. Create a local `.env` file with `ADMIN_PASSWORD` set to a strong password of at least 12 characters, then run `npm start`.

- Public hub at http://localhost:3000/
- Admin panel at http://localhost:3000/admin

Sign in to edit the homepage headline and introduction, business links, contact details, project counts, rating, and gallery. Choose a gallery category, then drop images onto the upload area or choose files. JPG, PNG and WebP are supported up to 10 MB each. Review the previews and select **Publish changes** to make them visible on the hub. The existing homepage image starts in Living Area.

For hosting, run one Node.js process behind HTTPS and set `DATA_DIR` to a writable persistent directory. Published edits are stored in `content.json` in that directory. By default the server uses the ignored `data/` directory in this project. Back up this file and the `uploads/` directory to preserve published edits when moving servers. The server binds to loopback by default. Set `HOST` and `PORT` as required by your host.

Quotation form submissions appear in **Enquiries** after signing in. They are stored in `enquiries.jsonl` under `DATA_DIR`. Keep this file private when backing it up. Direct WhatsApp chats do not appear in the inbox.

## Hosted deployment

Use a Vercel project that permits commercial use. Set production environment variables `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and a fresh `ADMIN_PASSWORD` of at least 12 characters. The Supabase secret is server-only. The hosted upload limit is 4 MB per photo.

The Supabase project needs the `public.showy_content` table with `content_key text primary key`, `payload jsonb not null`, and `updated_at timestamptz default now()`. Enable RLS, revoke access from public browser roles, and grant select, insert and update to `service_role`. Create a public Storage bucket named `showy-gallery` for the public portfolio images. Keep enquiry records in the private table.

To migrate local data, put the two Supabase variables in the ignored `.env.migration` file and run `node --env-file=.env.migration scripts/migrate-storage.mjs` from the repository root. The script uploads the referenced files before publishing the gallery and retains the local originals.
