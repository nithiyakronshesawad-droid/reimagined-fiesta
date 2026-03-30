const statusEl = document.getElementById("status");
const form = document.getElementById("login-form");
const checkBtn = document.getElementById("check-btn");
const logoutBtn = document.getElementById("logout-btn");

async function checkSession() {
  const res = await fetch("/api/me");
  if (!res.ok) {
    statusEl.textContent = "ยังไม่ได้ล็อกอิน";
    return;
  }
  const data = await res.json();
  statusEl.textContent = `ล็อกอินแล้ว: ${data.username}`;
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
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    statusEl.textContent = "ล็อกอินไม่สำเร็จ";
    return;
  }

  await checkSession();
});

checkBtn.addEventListener("click", checkSession);

logoutBtn.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  await checkSession();
});

checkSession();
