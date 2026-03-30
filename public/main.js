const form = document.getElementById("login-form");

function goByRole(role) {
  if (role === "admin") {
    window.location.href = "/admin.html";
    return;
  }
  window.location.href = "/women-fashion.html";
}

async function checkSession() {
  const res = await fetch("/api/me", { credentials: "include" });
  if (!res.ok) {
    return null;
  }
  return res.json();
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

  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    alert("ล็อกอินไม่สำเร็จ");
    return;
  }

  setTimeout(() => {
    goByRole(data.role);
  }, 300);
});

(async () => {
  const me = await checkSession();
  if (me) {
    goByRole(me.role);
  }
})();
