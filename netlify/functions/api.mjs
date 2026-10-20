import { getStore } from "@netlify/blobs";

export const config = { path: ["/api/entries", "/api/image"] };

const CATEGORIES = ["Cars & transport","Food & drink","Politics & news","Business & work","Health & illness","Shopping & retail","Technology","Finance & banking","Travel & holidays","Entertainment & media","Education","Home & garden","Fashion & beauty","Sports & fitness","Other"];
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export default async (req) => {
  const url = new URL(req.url);
  const entries = getStore("entries");
  const images = getStore("images");

  if (url.pathname === "/api/image" && req.method === "GET") {
    const buf = await images.get(url.searchParams.get("id") || "", { type: "arrayBuffer" });
    if (!buf) return new Response("Not found", { status: 404 });
    return new Response(buf, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=31536000, immutable" } });
  }
  if (url.pathname !== "/api/entries") return json({ error: "Not found" }, 404);

  if (req.method === "GET") {
    const { blobs } = await entries.list();
    const all = await Promise.all(blobs.map((b) => entries.get(b.key, { type: "json" })));
    return json(all.filter(Boolean));
  }

  if (req.method === "POST") {
    let b;
    try { b = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }
    const website = String(b.website || "").trim().slice(0, 100);
    const category = String(b.category || "");
    const note = String(b.note || "").trim().slice(0, 300);
    const age = Number.parseInt(b.age, 10);
    const imgs = Array.isArray(b.images) ? b.images : [];
    const prefix = "data:image/jpeg;base64,";
    if (!website) return json({ error: "Choose or enter the survey website." }, 400);
    if (!CATEGORIES.includes(category)) return json({ error: "Choose a category." }, 400);
    if (!note) return json({ error: "Add a short note to help others." }, 400);
    if (!(age >= 1 && age <= 120)) return json({ error: "Enter an age between 1 and 120." }, 400);
    if (imgs.length < 1 || imgs.length > 5) return json({ error: "Add between 1 and 5 images." }, 400);
    const files = [];
    let total = 0;
    for (const s of imgs) {
      if (typeof s !== "string" || !s.startsWith(prefix)) return json({ error: "One of the images isn’t valid." }, 400);
      const bytes = Buffer.from(s.slice(prefix.length), "base64");
      total += bytes.length;
      if (bytes.length > 1.5 * 1024 * 1024 || total > 3.5 * 1024 * 1024) return json({ error: "Images are too large. Remove one or use smaller pictures." }, 400);
      files.push(bytes);
    }
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const keys = files.map((_, i) => id + "-" + i);
    await Promise.all(files.map((f, i) => images.set(keys[i], f)));
    const entry = { id, website, category, note, age, images: keys, added: Date.now() };
    await entries.setJSON(id, entry);
    return json(entry, 201);
  }

  if (req.method === "DELETE") {
    const pw = process.env.ADMIN_PASSWORD;
    if (!pw) return json({ error: "Deleting is off. Set ADMIN_PASSWORD in Netlify to enable it." }, 403);
    if (req.headers.get("x-admin-password") !== pw) return json({ error: "Wrong admin password." }, 401);
    const id = url.searchParams.get("id") || "";
    const entry = await entries.get(id, { type: "json" });
    const keys = (entry && entry.images) || [id];
    await Promise.all(keys.map((k) => images.delete(k)));
    await entries.delete(id);
    return json({ ok: true });
  }
  return json({ error: "Method not allowed" }, 405);
};
