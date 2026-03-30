const welcomeEl = document.getElementById("welcome");
const refreshBtn = document.getElementById("refresh-btn");
const logoutBtn = document.getElementById("logout-btn");

async function loadProfile() {
  const res = await fetch("/api/me", { credentials: "include" });
  if (!res.ok) {
    window.location.href = "/";
    return;
  }

  const data = await res.json();
  welcomeEl.textContent = `สวัสดีคุณ ${data.username}`;
}

refreshBtn.addEventListener("click", loadProfile);

logoutBtn.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST", credentials: "include" });
  window.location.href = "/";
});

loadProfile();
