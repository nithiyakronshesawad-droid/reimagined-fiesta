const express = require("express");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const COOKIE_NAME = "session_id";
const SESSION_SECRET = process.env.SESSION_SECRET || "change-this-in-production";

// Demo user store. Replace with a database in real production.
const users = new Map([["admin", { password: "admin123" }]]);
const sessions = new Map();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static("public"));

function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}

function createSession(username) {
  const token = crypto.randomBytes(24).toString("hex");
  const value = `${token}.${sign(token)}`;
  sessions.set(token, { username, createdAt: Date.now() });
  return value;
}

function getUserFromCookie(rawCookie) {
  if (!rawCookie || !rawCookie.includes(".")) return null;
  const [token, sig] = rawCookie.split(".");
  if (sign(token) !== sig) return null;
  const session = sessions.get(token);
  return session ? session.username : null;
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Missing username or password" });
  }

  const user = users.get(username);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const sessionValue = createSession(username);
  res.cookie(COOKIE_NAME, sessionValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24
  });

  return res.json({ ok: true, username });
});

app.post("/api/logout", (req, res) => {
  const rawCookie = req.cookies[COOKIE_NAME];
  if (rawCookie && rawCookie.includes(".")) {
    const [token] = rawCookie.split(".");
    sessions.delete(token);
  }
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  const username = getUserFromCookie(req.cookies[COOKIE_NAME]);
  if (!username) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  return res.json({ username });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on http://localhost:${PORT}`);
});
