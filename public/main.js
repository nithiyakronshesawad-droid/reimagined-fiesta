const form = document.getElementById("login-form");

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

  if (!res.ok) {
    alert("ล็อกอินไม่สำเร็จ");
    return;
  }

  setTimeout(() => {
    window.location.href = "/admin.html";
  }, 400);
});

(async () => {
  const me = await checkSession();
  if (me && me.role === "admin") {
    window.location.href = "/admin.html";
  }
})();
