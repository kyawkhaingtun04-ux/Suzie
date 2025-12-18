// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   BASIC MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

/* =========================
   STATIC FILES
========================= */
const ROOT_DIR = process.cwd();
app.use(express.static(ROOT_DIR));

/* =========================
   GEMINI CONFIG
========================= */
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY is missing");
}

/* =========================
   /api/chat  (MAIN AI)
========================= */
app.post("/api/chat", async (req, res) => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: data.error || "Gemini API error",
      });
    }

    res.json(data);
  } catch (err) {
    console.error("❌ /api/chat error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   LINE USER LOOKUP
   /api/line-user?email=
========================= */
app.get("/api/line-user", (req, res) => {
  const { email } = req.query;
  if (!email) return res.json({});

  // Example mapping (replace with DB later)
  const file = "./line_users.json";

  if (!fs.existsSync(file)) {
    return res.json({});
  }

  const data = JSON.parse(fs.readFileSync(file, "utf-8"));
  res.json({ lineUserId: data[email] || null });
});

/* =========================
   LINE REMINDER API
   /api/reminder
========================= */
app.post("/api/reminder", async (req, res) => {
  const { email, lineUserId, text, timeISO } = req.body;

  if (!email || !text || !timeISO) {
    return res.status(400).json({ error: "Missing data" });
  }

  console.log("🔔 Reminder received:", {
    email,
    lineUserId,
    text,
    timeISO,
  });

  // 👉 Here you later trigger LINE Messaging API
  // For now we just accept & log

  res.json({ success: true });
});

/* =========================
   FALLBACK (SPA SUPPORT)
========================= */
app.get("*", (req, res) => {
  res.sendFile(path.join(ROOT_DIR, "index.html"));
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`🚀 SUZI server running on port ${PORT}`);
});
