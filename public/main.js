const statusEl = document.getElementById("status");
const form = document.getElementById("login-form");
const checkBtn = document.getElementById("check-btn");
const logoutBtn = document.getElementById("logout-btn");

async function checkSession() {
  const res = await fetch("/api/me", { credentials: "include" });
  if (!res.ok) {
    statusEl.textContent = "ยังไม่ได้ล็อกอิน";
    return null;
  }

  const data = await res.json();
  statusEl.textContent = `ล็อกอินแล้ว: ${data.username} (${data.role})`;
  return data;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(form);
  const payload = {
    username: formData.get("username"),
    password: formData.get("password")
  };

  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include"
  });

  if (!res.ok) {
    statusEl.textContent = "ล็อกอินไม่สำเร็จ";
    return;
  }

  statusEl.textContent = "ล็อกอินสำเร็จ กำลังพาไปหลังบ้าน...";
  setTimeout(() => {
    window.location.href = "/admin.html";
  }, 400);
});

checkBtn.addEventListener("click", checkSession);

logoutBtn.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST", credentials: "include" });
  await checkSession();
});

(async () => {
  const me = await checkSession();
  if (me && me.role === "admin") {
    window.location.href = "/admin.html";
  }
})();
