// /api/gcal-book.js
// Vercel serverless function: creates a Google Calendar event
// Node 18+ (native fetch)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  try {
    const {
      name,
      email,
      phone,
      service,          // e.g. "Mindful Kintsugi Session"
      notes,            // optional
      startISO,         // ISO like "2025-11-12T15:00:00+03:00"
      durationMins = 60 // default 60
    } = req.body || {};

    if (!name || !email || !service || !startISO) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }

    const start = new Date(startISO);
    const end = new Date(start.getTime() + durationMins * 60 * 1000);

    // 1) Exchange refresh_token -> access_token
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GCAL_CLIENT_ID,
        client_secret: process.env.GCAL_CLIENT_SECRET,
        refresh_token: process.env.GCAL_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenResp.ok) {
      const t = await tokenResp.text();
      return res.status(500).json({ ok: false, error: "OAuth token error", detail: t });
    }
    const { access_token } = await tokenResp.json();

    // 2) Create the event
    const calendarId = process.env.GCAL_CALENDAR_ID || "primary";

    const eventBody = {
      summary: `${service} — ${name}`,
      description:
        `Website booking for ${service}\n\nClient: ${name}\nEmail: ${email}\nPhone: ${phone || "—"}\n\nNotes:\n${notes || "—"}`,
      start: { dateTime: start.toISOString() },
      end:   { dateTime: end.toISOString() },
      attendees: email ? [{ email, displayName: name }] : [],
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 },
          { method: "popup", minutes: 30 }
        ]
      }
    };

    const createResp = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventBody),
      }
    );

    const eventJson = await createResp.json();
    if (!createResp.ok) {
      return res.status(500).json({ ok: false, error: "Calendar create error", detail: eventJson });
    }

    return res.status(200).json({
      ok: true,
      eventId: eventJson.id,
      htmlLink: eventJson.htmlLink,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Server error", detail: err?.message || String(err) });
  }
}
