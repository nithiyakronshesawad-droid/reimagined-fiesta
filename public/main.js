const form = document.getElementById("login-form");
const STORAGE_USERS = "vm_users";
const STORAGE_SESSION = "vm_session";

function seedUsers() {
  const raw = localStorage.getItem(STORAGE_USERS);
  if (raw) return;
  const users = [
    { username: "admin", password: "admin123", role: "admin", fullName: "System Admin" }
  ];
  localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
}

function goByRole(role) {
  if (role === "admin") {
    window.location.href = "/admin.html";
    return;
  }
  window.location.href = "/women-fashion.html";
}

function staticLogin(username, password) {
  seedUsers();
  const users = JSON.parse(localStorage.getItem(STORAGE_USERS) || "[]");
  const user = users.find((u) => u.username === username && u.password === password);
  if (!user) return null;
  const session = { username: user.username, role: user.role || "customer" };
  localStorage.setItem(STORAGE_SESSION, JSON.stringify(session));
  return session;
}

async function checkSession() {
  try {
    const res = await fetch("/api/me", { credentials: "include" });
    if (res.ok) return res.json();
  } catch (e) {
    // Static hosting fallback
  }
  const raw = localStorage.getItem(STORAGE_SESSION);
  return raw ? JSON.parse(raw) : null;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(form);
  const payload = {
    username: formData.get("username"),
    password: formData.get("password")
  };

  let data = null;
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include"
    });
    data = await res.json().catch(() => null);
    if (!res.ok || !data) throw new Error("api login failed");
  } catch (e) {
    data = staticLogin(payload.username, payload.password);
  }

  if (!data) {
    alert("ล็อกอินไม่สำเร็จ");
    return;
  }

  setTimeout(() => {
    goByRole(data.role);
  }, 300);
});

(async () => {
  seedUsers();
  const me = await checkSession();
  if (me) {
    goByRole(me.role);
  }
})();
