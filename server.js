const express = require("express");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;
const COOKIE_NAME = "session_id";
const SESSION_SECRET = process.env.SESSION_SECRET || "change-this-in-production";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const defaultDbDir = process.platform === "win32"
  ? path.join(os.tmpdir(), "login-system")
  : "/tmp/login-system";
const DB_DIR = process.env.DB_DIR || defaultDbDir;
fs.mkdirSync(DB_DIR, { recursive: true });
const DB_PATH = path.join(DB_DIR, "data.sqlite");
const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      return resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      return resolve(row);
    });
  });
}

async function initDb() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `);

  const existingAdmin = await get("SELECT username FROM users WHERE username = ?", [ADMIN_USERNAME]);
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await run("INSERT INTO users (username, password_hash) VALUES (?, ?)", [ADMIN_USERNAME, passwordHash]);
  }
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static("public"));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." }
});

function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}

async function createSession(username) {
  const token = crypto.randomBytes(24).toString("hex");
  const value = `${token}.${sign(token)}`;
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24;
  await run("INSERT INTO sessions (token, username, expires_at) VALUES (?, ?, ?)", [token, username, expiresAt]);
  return value;
}

async function getUserFromCookie(rawCookie) {
  if (!rawCookie || !rawCookie.includes(".")) return null;
  const [token, sig] = rawCookie.split(".");
  if (sign(token) !== sig) return null;
  const session = await get("SELECT username, expires_at FROM sessions WHERE token = ?", [token]);
  if (!session) return null;
  if (session.expires_at < Date.now()) {
    await run("DELETE FROM sessions WHERE token = ?", [token]);
    return null;
  }
  return session.username;
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.post("/api/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Missing username or password" });
  }

  const user = await get("SELECT username, password_hash FROM users WHERE username = ?", [username]);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const sessionValue = await createSession(username);
  res.cookie(COOKIE_NAME, sessionValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24
  });

  return res.json({ ok: true, username });
});

app.post("/api/logout", async (req, res) => {
  const rawCookie = req.cookies[COOKIE_NAME];
  if (rawCookie && rawCookie.includes(".")) {
    const [token] = rawCookie.split(".");
    await run("DELETE FROM sessions WHERE token = ?", [token]);
  }
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get("/api/me", async (req, res) => {
  const username = await getUserFromCookie(req.cookies[COOKIE_NAME]);
  if (!username) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  return res.json({ username });
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to start server:", error);
    process.exit(1);
  });
