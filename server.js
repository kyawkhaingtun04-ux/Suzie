import express from "express";
import crypto from "crypto";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

/* =========================================================
   TEMP STORAGE (replace with DB later)
   ========================================================= */
global.lineUsers = global.lineUsers || {};     // email ↔ lineUserId
global.reminders = global.reminders || [];     // reminder list

/* =========================================================
   UTIL: Send LINE message
   ========================================================= */
async function sendLineMessage(lineUserId, text) {
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.LINE_TOKEN}`
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [
        {
          type: "text",
          text: `🔔 SUZI Reminder\n\n${text}`
        }
      ]
    })
  });

  const body = await res.text();
  console.log("LINE push:", res.status, body);
}

/* =========================================================
   HEALTH CHECK
   ========================================================= */
app.get("/", (req, res) => {
  res.send("✅ SUZI LINE server is running");
});

/* =========================================================
   1️⃣ LINE WEBHOOK
   (User sends message to LINE bot)
   ========================================================= */
app.post("/api/line-webhook", (req, res) => {
  const events = req.body.events || [];

  for (const event of events) {
    const lineUserId = event.source?.userId;
    if (!lineUserId) continue;

    // store as unlinked LINE user
    if (!global.lineUsers[lineUserId]) {
      global.lineUsers[lineUserId] = {
        lineUserId,
        email: null,
        lastSeen: Date.now()
      };
    } else {
      global.lineUsers[lineUserId].lastSeen = Date.now();
    }

    console.log("✅ LINE user detected:", lineUserId);
  }

  res.sendStatus(200);
});

/* =========================================================
   2️⃣ LINK LINE ↔ EMAIL (called after web login)
   ========================================================= */
app.post("/api/link-line-email", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "email required" });

  // find most recent unlinked LINE user
  const candidates = Object.values(global.lineUsers)
    .filter(u => u.email === null)
    .sort((a, b) => b.lastSeen - a.lastSeen);

  if (candidates.length === 0) {
    return res.json({ ok: false, message: "no LINE user found" });
  }

  candidates[0].email = email;

  console.log(`🔗 Linked LINE ${candidates[0].lineUserId} ↔ ${email}`);
  res.json({ ok: true });
});

/* =========================================================
   3️⃣ GET LINE USER BY EMAIL (frontend fetch)
   ========================================================= */
app.get("/api/line-user", (req, res) => {
  const email = req.query.email;
  if (!email) return res.json({ lineUserId: null });

  const user = Object.values(global.lineUsers).find(
    u => u.email === email
  );

  res.json({ lineUserId: user?.lineUserId || null });
});

/* =========================================================
   4️⃣ SAVE REMINDER (from SUZI web)
   ========================================================= */
app.post("/api/reminder", (req, res) => {
  const { email, lineUserId, text, timeISO } = req.body;

  if (!email || !lineUserId || !timeISO) {
    return res.status(400).json({ error: "missing fields" });
  }

  global.reminders.push({
    email,
    lineUserId,
    text,
    timeISO,
    sent: false,
    createdAt: Date.now()
  });

  console.log("⏰ Reminder saved:", email, timeISO);
  res.json({ ok: true });
});

/* =========================================================
   5️⃣ CHECK REMINDERS (cron / GitHub Actions)
   ========================================================= */
app.get("/api/check-reminders", async (req, res) => {
  const now = new Date();

  for (const r of global.reminders) {
    if (!r.sent && new Date(r.timeISO) <= now) {
      await sendLineMessage(r.lineUserId, r.text);
      r.sent = true;
      console.log("📨 Reminder sent to:", r.email);
    }
  }

  res.json({ ok: true });
});

/* =========================================================
   START SERVER
   ========================================================= */
app.listen(PORT, () => {
  console.log(`🚀 SUZI LINE server running on port ${PORT}`);
});
