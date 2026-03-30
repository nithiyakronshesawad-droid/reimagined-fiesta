const express = require("express");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;
const COOKIE_NAME = "session_id";
const SESSION_SECRET = process.env.SESSION_SECRET || "change-this-in-production";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const defaultDbDir = process.platform === "win32" ? path.join(os.tmpdir(), "login-system") : "/tmp/login-system";
const DB_DIR = process.env.DB_DIR || defaultDbDir;
const DB_PATH = path.join(DB_DIR, "data.json");

function ensureDbFile() {
  fs.mkdirSync(DB_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    const initialData = { users: [], sessions: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), "utf8");
  }
}

function loadDb() {
  const raw = fs.readFileSync(DB_PATH, "utf8");
  return JSON.parse(raw);
}

function saveDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
}

async function initDb() {
  ensureDbFile();
  const data = loadDb();
  const existingAdmin = data.users.find((u) => u.username === ADMIN_USERNAME);
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    data.users.push({ username: ADMIN_USERNAME, passwordHash });
    saveDb(data);
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

function createSession(username) {
  const token = crypto.randomBytes(24).toString("hex");
  const value = `${token}.${sign(token)}`;
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24;
  const data = loadDb();
  data.sessions = data.sessions.filter((s) => s.expiresAt > Date.now());
  data.sessions.push({ token, username, expiresAt });
  saveDb(data);
  return value;
}

function getUserFromCookie(rawCookie) {
  if (!rawCookie || !rawCookie.includes(".")) return null;
  const [token, sig] = rawCookie.split(".");
  if (sign(token) !== sig) return null;

  const data = loadDb();
  const session = data.sessions.find((s) => s.token === token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    data.sessions = data.sessions.filter((s) => s.token !== token);
    saveDb(data);
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

  const data = loadDb();
  const user = data.users.find((u) => u.username === username);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
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
    const data = loadDb();
    data.sessions = data.sessions.filter((s) => s.token !== token);
    saveDb(data);
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
