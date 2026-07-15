// Relay: the Studio client POSTs a freshly-exported poster here (same-origin), and
// this forwards it to the FCN ops-board poster gallery server-to-server, keeping the
// ingest key out of the browser. Fire-and-forget from the client's perspective.
//
// Env (set on the Studio's Netlify site):
//   FCN_OPS_POSTERS_URL = https://fcn-ops-board.netlify.app/api/posters
//   FCN_OPS_INGEST_KEY  = <the ops board's POSTER_INGEST_KEY>
export default async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const url = process.env.FCN_OPS_POSTERS_URL;
  const key = process.env.FCN_OPS_INGEST_KEY;
  if (!url || !key) return json({ error: "poster gallery not configured" }, 503);

  let body;
  try { body = await req.json(); } catch { return json({ error: "bad request" }, 400); }
  if (!body || typeof body.image !== "string") return json({ error: "image required" }, 400);

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-fcn-ingest-key": key },
      body: JSON.stringify({ image: body.image, caption: body.caption, type: body.type || "Poster" }),
    });
    return json({ ok: r.ok, status: r.status }, r.ok ? 200 : 502);
  } catch (e) {
    console.error("save-poster relay failed", e);
    return json({ error: "relay failed" }, 502);
  }
};

function json(b, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
}

export const config = { path: "/api/save-poster" };
