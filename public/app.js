const $ = (id) => document.getElementById(id);

const api = (path, opts = {}) =>
  fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...opts.headers },
    ...opts,
  });

function formatBytes(n) {
  if (n == null) return "—";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0, v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

function getInitial(email) {
  return (email || "U")[0].toUpperCase();
}

function showGuest() {
  $("guestPanel").classList.remove("hidden");
  $("appPanel").classList.add("hidden");
  $("userChip").classList.add("hidden");
}

function showApp(email) {
  $("guestPanel").classList.add("hidden");
  $("appPanel").classList.remove("hidden");
  $("userChip").classList.remove("hidden");
  $("userEmail").textContent = email;
  $("userInitial").textContent = getInitial(email);
}

function setGlobalError(msg) {
  const el = $("globalError");
  if (!msg) { el.classList.add("hidden"); el.textContent = ""; return; }
  el.textContent = msg;
  el.classList.remove("hidden");
}

function setFormError(id, msg) {
  const el = $(id);
  if (!msg) { el.classList.add("hidden"); el.className = "hidden"; el.textContent = ""; return; }
  el.textContent = msg;
  el.className = "alert alert-error";
}

function setStatus(msg, type = "muted") {
  const el = $("uploadStatus");
  if (type === "success") {
    el.style.color = "var(--green)";
  } else if (type === "error") {
    el.style.color = "var(--danger)";
  } else {
    el.style.color = "var(--text-muted)";
  }
  el.textContent = msg;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function refreshFiles() {
  const tbody = $("fileRows");
  const emptyState = $("emptyState");
  const fileCount = $("fileCount");
  tbody.innerHTML = "";

  const res = await api("/api/files/list");
  if (res.status === 401) { showGuest(); return; }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    setStatus(data.error || "Could not load files.", "error");
    return;
  }

  const files = data.files || [];
  fileCount.textContent = files.length ? `${files.length} object${files.length !== 1 ? "s" : ""}` : "";

  if (!files.length) {
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");

  for (const f of files) {
    const tr = document.createElement("tr");
    const rel = escapeHtml(f.relativePath);
    tr.innerHTML = `
      <td class="path-cell">${rel}</td>
      <td class="size-cell">${formatBytes(f.size)}</td>
      <td class="actions-cell">
        <div class="action-row">
          <a href="#" class="btn btn-secondary dl" data-key="${encodeURIComponent(f.key)}" style="height:30px;font-size:0.78rem;padding:0 0.6rem">
            Download
          </a>
          <button type="button" class="btn btn-danger del" data-key="${encodeURIComponent(f.key)}" style="height:30px;font-size:0.78rem;padding:0 0.6rem">
            Delete
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll("a.dl").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const key = decodeURIComponent(a.dataset.key);
      window.location.href = `/api/files/download?key=${encodeURIComponent(key)}`;
    });
  });

  tbody.querySelectorAll("button.del").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const key = decodeURIComponent(btn.dataset.key);
      if (!confirm("Delete this object from storage?")) return;
      const d = await api("/api/files/object", { method: "DELETE", body: JSON.stringify({ key }) });
      const dj = await d.json().catch(() => ({}));
      if (!d.ok) { setStatus(dj.error || "Delete failed.", "error"); return; }
      setStatus("Object deleted.", "success");
      refreshFiles();
    });
  });
}

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  setFormError("loginError", "");
  const fd = new FormData(e.target);
  const body = { email: fd.get("email"), password: fd.get("password") };
  const res = await api("/api/auth/login", { method: "POST", body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { setFormError("loginError", data.error || "Login failed."); return; }
  showApp(data.user.email);
  setGlobalError("");
  setStatus("");
  refreshFiles();
});

$("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  setFormError("signupError", "");
  const fd = new FormData(e.target);
  const body = { email: fd.get("email"), password: fd.get("password") };
  const res = await api("/api/auth/signup", { method: "POST", body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { setFormError("signupError", data.error || "Signup failed."); return; }
  showApp(data.user.email);
  setGlobalError("");
  setStatus("");
  refreshFiles();
});

$("logoutBtn").addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  showGuest();
});

$("refreshBtn").addEventListener("click", () => refreshFiles());

async function uploadFileList(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  setStatus(`Uploading ${files.length} file${files.length !== 1 ? "s" : ""}…`);
  const form = new FormData();
  for (const file of files) {
    const name = file.webkitRelativePath || file.name;
    form.append("files", file, name);
  }
  const res = await fetch("/api/files/upload", { method: "POST", credentials: "include", body: form });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { showGuest(); setStatus(""); return; }
  if (!res.ok) { setStatus(data.error || "Upload failed.", "error"); return; }
  setStatus(`${data.uploaded?.length || 0} object(s) uploaded.`, "success");
  refreshFiles();
}

$("fileInput").addEventListener("change", (e) => { uploadFileList(e.target.files); e.target.value = ""; });
$("folderInput").addEventListener("change", (e) => { uploadFileList(e.target.files); e.target.value = ""; });

(async () => {
  try {
    const res = await api("/api/auth/me");
    const data = await res.json().catch(() => ({}));
    if (data.user) { showApp(data.user.email); await refreshFiles(); }
    else { showGuest(); }
  } catch {
    showGuest();
    setGlobalError("Could not reach server.");
  }
})();