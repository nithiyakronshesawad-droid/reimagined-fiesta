const rowsEl = document.getElementById("rows");
const msgEl = document.getElementById("msg");
const usersRowsEl = document.getElementById("users-rows");
const usersMsgEl = document.getElementById("users-msg");
const form = document.getElementById("create-form");
const refreshBtn = document.getElementById("refresh-btn");
const refreshUsersBtn = document.getElementById("refresh-users-btn");
const logoutBtn = document.getElementById("logout-btn");

function esc(v = "") {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function getMe() {
  const res = await fetch("/api/me", { credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

async function fetchCustomers() {
  const res = await fetch("/api/admin/customers", { credentials: "include" });
  if (!res.ok) {
    msgEl.textContent = "โหลดข้อมูลไม่สำเร็จ";
    rowsEl.innerHTML = "";
    return;
  }

  const data = await res.json();
  const customers = data.customers || [];

  if (customers.length === 0) {
    rowsEl.innerHTML = "<tr><td colspan='6'>ยังไม่มีข้อมูลลูกค้า</td></tr>";
    msgEl.textContent = "0 รายการ";
    return;
  }

  msgEl.textContent = `${customers.length} รายการ`;
  rowsEl.innerHTML = customers
    .map(
      (c) => `
      <tr data-id="${c.id}">
        <td><input data-field="name" value="${esc(c.name)}" /></td>
        <td><input data-field="email" value="${esc(c.email)}" /></td>
        <td><input data-field="phone" value="${esc(c.phone)}" /></td>
        <td><input data-field="status" value="${esc(c.status)}" /></td>
        <td><input data-field="notes" value="${esc(c.notes)}" /></td>
        <td class="actions">
          <button class="save-btn" type="button">Save</button>
          <button class="danger delete-btn" type="button">Delete</button>
        </td>
      </tr>`
    )
    .join("");
}

async function fetchUsers() {
  const res = await fetch("/api/admin/users", { credentials: "include" });
  if (!res.ok) {
    usersMsgEl.textContent = "โหลดรายชื่อสมาชิกไม่สำเร็จ";
    usersRowsEl.innerHTML = "";
    return;
  }

  const data = await res.json();
  const users = data.users || [];

  usersMsgEl.textContent = `${users.length} รายการ`;
  if (users.length === 0) {
    usersRowsEl.innerHTML = "<tr><td colspan='5'>ยังไม่มีสมาชิกสมัครใหม่</td></tr>";
    return;
  }

  usersRowsEl.innerHTML = users
    .map(
      (u) => `
      <tr>
        <td>${esc(u.fullName)}</td>
        <td>${esc(u.username)}</td>
        <td>${esc(u.email)}</td>
        <td>${esc(u.phone)}</td>
        <td>${esc((u.createdAt || "").replace("T", " ").slice(0, 16))}</td>
      </tr>`
    )
    .join("");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    name: form.name.value,
    email: form.email.value,
    phone: form.phone.value,
    status: form.status.value,
    notes: form.notes.value
  };

  const res = await fetch("/api/admin/customers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include"
  });

  if (!res.ok) {
    msgEl.textContent = "เพิ่มลูกค้าไม่สำเร็จ";
    return;
  }

  form.reset();
  form.status.value = "active";
  await fetchCustomers();
});

rowsEl.addEventListener("click", async (e) => {
  const tr = e.target.closest("tr[data-id]");
  if (!tr) return;

  const id = tr.dataset.id;
  if (e.target.classList.contains("save-btn")) {
    const payload = {};
    tr.querySelectorAll("input[data-field]").forEach((input) => {
      payload[input.dataset.field] = input.value;
    });

    const res = await fetch(`/api/admin/customers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include"
    });

    if (!res.ok) {
      msgEl.textContent = "บันทึกไม่สำเร็จ";
      return;
    }

    msgEl.textContent = "บันทึกเรียบร้อย";
    await fetchCustomers();
  }

  if (e.target.classList.contains("delete-btn")) {
    if (!window.confirm("ยืนยันการลบลูกค้ารายนี้?")) return;

    const res = await fetch(`/api/admin/customers/${id}`, {
      method: "DELETE",
      credentials: "include"
    });

    if (!res.ok) {
      msgEl.textContent = "ลบไม่สำเร็จ";
      return;
    }

    await fetchCustomers();
  }
});

refreshBtn.addEventListener("click", fetchCustomers);
refreshUsersBtn.addEventListener("click", fetchUsers);

logoutBtn.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST", credentials: "include" });
  window.location.href = "/";
});

(async () => {
  const me = await getMe();
  if (!me || me.role !== "admin") {
    window.location.href = "/";
    return;
  }
  await fetchCustomers();
  await fetchUsers();
})();
