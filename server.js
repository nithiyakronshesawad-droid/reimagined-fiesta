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
    const initialData = { users: [], sessions: [], customers: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), "utf8");
  }
}

function loadDb() {
  const raw = fs.readFileSync(DB_PATH, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data.users)) data.users = [];
  if (!Array.isArray(data.sessions)) data.sessions = [];
  if (!Array.isArray(data.customers)) data.customers = [];
  return data;
}

function saveDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
}

function newCustomerId() {
  return crypto.randomBytes(8).toString("hex");
}

function newUserId() {
  return crypto.randomBytes(8).toString("hex");
}

async function initDb() {
  ensureDbFile();
  const data = loadDb();

  const existingAdmin = data.users.find((u) => u.username === ADMIN_USERNAME);
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    data.users.push({
      id: newUserId(),
      fullName: "System Admin",
      email: "",
      phone: "",
      username: ADMIN_USERNAME,
      passwordHash,
      role: "admin",
      createdAt: new Date().toISOString()
    });
  } else if (!existingAdmin.role) {
    existingAdmin.role = "admin";
    if (!existingAdmin.id) existingAdmin.id = newUserId();
    if (!existingAdmin.createdAt) existingAdmin.createdAt = new Date().toISOString();
  }

  if (data.customers.length === 0) {
    data.customers.push(
      {
        id: newCustomerId(),
        name: "Somchai Prasert",
        email: "somchai@example.com",
        phone: "0812345678",
        status: "active",
        notes: "VIP customer",
        updatedAt: new Date().toISOString()
      },
      {
        id: newCustomerId(),
        name: "Nina Techakul",
        email: "nina@example.com",
        phone: "0899988877",
        status: "pending",
        notes: "Waiting for profile completion",
        updatedAt: new Date().toISOString()
      }
    );
  }

  saveDb(data);
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

function getSessionUser(rawCookie) {
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

  const user = data.users.find((u) => u.username === session.username);
  if (!user) return null;

  return { username: user.username, role: user.role || "admin", token };
}

function requireAdmin(req, res, next) {
  const sessionUser = getSessionUser(req.cookies[COOKIE_NAME]);
  if (!sessionUser) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  if (sessionUser.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  req.sessionUser = sessionUser;
  return next();
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

  return res.json({ ok: true, username, role: user.role || "admin" });
});

app.post("/api/register", async (req, res) => {
  const {
    fullName = "",
    email = "",
    phone = "",
    username = "",
    password = "",
    confirmPassword = ""
  } = req.body;

  if (String(fullName).trim().length < 2) {
    return res.status(400).json({ error: "กรุณากรอกชื่อให้ถูกต้อง" });
  }
  if (String(username).trim().length < 3) {
    return res.status(400).json({ error: "ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร" });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "รหัสผ่านไม่ตรงกัน" });
  }

  const data = loadDb();
  const usernameTaken = data.users.some((u) => u.username.toLowerCase() === String(username).trim().toLowerCase());
  if (usernameTaken) {
    return res.status(409).json({ error: "ชื่อผู้ใช้นี้ถูกใช้แล้ว" });
  }

  if (email) {
    const emailTaken = data.users.some(
      (u) => u.email && u.email.toLowerCase() === String(email).trim().toLowerCase()
    );
    if (emailTaken) {
      return res.status(409).json({ error: "อีเมลนี้ถูกใช้แล้ว" });
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = {
    id: newUserId(),
    fullName: String(fullName).trim(),
    email: String(email).trim(),
    phone: String(phone).trim(),
    username: String(username).trim(),
    passwordHash,
    role: "customer",
    createdAt: new Date().toISOString()
  };

  data.users.push(newUser);
  saveDb(data);
  return res.status(201).json({ ok: true });
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
  const sessionUser = getSessionUser(req.cookies[COOKIE_NAME]);
  if (!sessionUser) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  return res.json({ username: sessionUser.username, role: sessionUser.role });
});

app.get("/api/admin/customers", requireAdmin, (req, res) => {
  const data = loadDb();
  return res.json({ customers: data.customers });
});

app.get("/api/admin/users", requireAdmin, (req, res) => {
  const data = loadDb();
  const users = data.users
    .filter((u) => (u.role || "customer") !== "admin")
    .map((u) => ({
      id: u.id || "",
      fullName: u.fullName || "",
      email: u.email || "",
      phone: u.phone || "",
      username: u.username || "",
      role: u.role || "customer",
      createdAt: u.createdAt || ""
    }));
  return res.json({ users });
});

app.post("/api/admin/customers", requireAdmin, (req, res) => {
  const { name, email = "", phone = "", status = "active", notes = "" } = req.body;
  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ error: "Name is required" });
  }

  const customer = {
    id: newCustomerId(),
    name: String(name).trim(),
    email: String(email).trim(),
    phone: String(phone).trim(),
    status: String(status).trim() || "active",
    notes: String(notes).trim(),
    updatedAt: new Date().toISOString()
  };

  const data = loadDb();
  data.customers.unshift(customer);
  saveDb(data);
  return res.status(201).json({ ok: true, customer });
});

app.put("/api/admin/customers/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const data = loadDb();
  const customer = data.customers.find((c) => c.id === id);
  if (!customer) {
    return res.status(404).json({ error: "Customer not found" });
  }

  const { name, email, phone, status, notes } = req.body;
  if (name !== undefined) customer.name = String(name).trim();
  if (email !== undefined) customer.email = String(email).trim();
  if (phone !== undefined) customer.phone = String(phone).trim();
  if (status !== undefined) customer.status = String(status).trim() || "active";
  if (notes !== undefined) customer.notes = String(notes).trim();

  if (!customer.name || customer.name.length < 2) {
    return res.status(400).json({ error: "Name is required" });
  }

  customer.updatedAt = new Date().toISOString();
  saveDb(data);
  return res.json({ ok: true, customer });
});

app.delete("/api/admin/customers/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const data = loadDb();
  const before = data.customers.length;
  data.customers = data.customers.filter((c) => c.id !== id);
  if (data.customers.length === before) {
    return res.status(404).json({ error: "Customer not found" });
  }
  saveDb(data);
  return res.json({ ok: true });
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
