import { getStore } from "@netlify/blobs";

export const config = { path: ["/api/entries", "/api/image"] };

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export default async (req) => {
  const url = new URL(req.url);
  const entries = getStore("entries");
  const images = getStore("images");

  if (url.pathname === "/api/image" && req.method === "GET") {
    const id = url.searchParams.get("id") || "";
    const buf = await images.get(id, { type: "arrayBuffer" });
    if (!buf) return new Response("Not found", { status: 404 });
    return new Response(buf, {
      headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=31536000, immutable" },
    });
  }

  if (url.pathname !== "/api/entries") return json({ error: "Not found" }, 404);

  if (req.method === "GET") {
    const { blobs } = await entries.list();
    const all = await Promise.all(blobs.map((b) => entries.get(b.key, { type: "json" })));
    return json(all.filter(Boolean));
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }
    const website = String(body.website || "").trim().slice(0, 200);
    const age = Number.parseInt(body.age, 10);
    const image = String(body.image || "");
    const prefix = "data:image/jpeg;base64,";
    if (!website) return json({ error: "Enter the survey website." }, 400);
    if (!(age >= 1 && age <= 120)) return json({ error: "Enter an age between 1 and 120." }, 400);
    if (!image.startsWith(prefix)) return json({ error: "Add an image of the answer." }, 400);
    const bytes = Buffer.from(image.slice(prefix.length), "base64");
    if (bytes.length > 2 * 1024 * 1024) return json({ error: "Image is too large (max 2 MB)." }, 400);
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    await images.set(id, bytes);
    const entry = { id, website, age, added: Date.now() };
    await entries.setJSON(id, entry);
    return json(entry, 201);
  }

  if (req.method === "DELETE") {
    const pw = process.env.ADMIN_PASSWORD;
    if (!pw) return json({ error: "Deleting is off. Set ADMIN_PASSWORD in Netlify to enable it." }, 403);
    if (req.headers.get("x-admin-password") !== pw) return json({ error: "Wrong admin password." }, 401);
    const id = url.searchParams.get("id") || "";
    await entries.delete(id);
    await images.delete(id);
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
};
