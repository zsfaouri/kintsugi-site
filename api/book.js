// POST /api/book
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const { topic = "Kintsugi Session", startISO, durationMins = 60, timezone = "Asia/Dubai" } = req.body || {};
    if (!startISO) return res.status(400).json({ error: "Missing startISO" });

    // Get Zoom access token
    const basic = Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString("base64");

    const tokenResp = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
      { method: "POST", headers: { Authorization: `Basic ${basic}` } }
    );
    if (!tokenResp.ok) {
      const t = await tokenResp.text();
      return res.status(500).json({ error: `Zoom token error: ${tokenResp.status} ${t}` });
    }
    const { access_token } = await tokenResp.json();

    // Create meeting
    const createResp = await fetch("https://api.zoom.us/v2/users/me/meetings", {
      method: "POST",
      headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        type: 2,
        start_time: startISO,
        duration: Number(durationMins),
        timezone,
        settings: { join_before_host: false, waiting_room: true, approval_type: 2 },
      }),
    });

    const data = await createResp.json();
    if (!createResp.ok) return res.status(createResp.status).json({ error: data.message || "Zoom error", raw: data });

    return res.status(200).json({
      ok: true,
      join_url: data.join_url,
      start_url: data.start_url,
      start_time: data.start_time,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Unexpected error" });
  }
}
