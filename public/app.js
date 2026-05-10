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
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
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
}

function setGlobalError(msg) {
  const el = $("globalError");
  if (!msg) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.textContent = msg;
  el.classList.remove("hidden");
}

async function refreshFiles() {
  const tbody = $("fileRows");
  const empty = $("emptyHint");
  tbody.innerHTML = "";
  const res = await api("/api/files/list");
  if (res.status === 401) {
    showGuest();
    return;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    $("uploadStatus").textContent = data.error || "Could not load files.";
    return;
  }
  const files = data.files || [];
  if (!files.length) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  for (const f of files) {
    const tr = document.createElement("tr");
    const rel = escapeHtml(f.relativePath);
    tr.innerHTML = `
      <td class="path-cell">${rel}</td>
      <td class="col-num">${formatBytes(f.size)}</td>
      <td class="col-actions">
        <a class="link-btn dl" href="#" data-key="${encodeURIComponent(f.key)}">Download</a>
        <button type="button" class="link-btn danger del" data-key="${encodeURIComponent(f.key)}">Delete</button>
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
      const d = await api("/api/files/object", {
        method: "DELETE",
        body: JSON.stringify({ key }),
      });
      const dj = await d.json().catch(() => ({}));
      if (!d.ok) {
        $("uploadStatus").textContent = dj.error || "Delete failed.";
        return;
      }
      $("uploadStatus").textContent = "Deleted.";
      refreshFiles();
    });
  });
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("loginError").textContent = "";
  const fd = new FormData(e.target);
  const body = { email: fd.get("email"), password: fd.get("password") };
  const res = await api("/api/auth/login", { method: "POST", body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    $("loginError").textContent = data.error || "Login failed.";
    return;
  }
  showApp(data.user.email);
  setGlobalError("");
  $("uploadStatus").textContent = "";
  refreshFiles();
});

document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("signupError").textContent = "";
  const fd = new FormData(e.target);
  const body = { email: fd.get("email"), password: fd.get("password") };
  const res = await api("/api/auth/signup", { method: "POST", body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    $("signupError").textContent = data.error || "Signup failed.";
    return;
  }
  showApp(data.user.email);
  setGlobalError("");
  $("uploadStatus").textContent = "";
  refreshFiles();
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  showGuest();
});

document.getElementById("refreshBtn").addEventListener("click", () => refreshFiles());

async function uploadFileList(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const status = $("uploadStatus");
  status.textContent = "Uploading…";
  const form = new FormData();
  for (const file of files) {
    const name = file.webkitRelativePath || file.name;
    form.append("files", file, name);
  }
  const res = await fetch("/api/files/upload", { method: "POST", credentials: "include", body: form });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    showGuest();
    status.textContent = "";
    return;
  }
  if (!res.ok) {
    status.textContent = data.error || "Upload failed.";
    return;
  }
  status.textContent = `Uploaded ${data.uploaded?.length || 0} object(s).`;
  refreshFiles();
}

$("fileInput").addEventListener("change", (e) => {
  uploadFileList(e.target.files);
  e.target.value = "";
});

$("folderInput").addEventListener("change", (e) => {
  uploadFileList(e.target.files);
  e.target.value = "";
});

(async () => {
  try {
    const res = await api("/api/auth/me");
    const data = await res.json().catch(() => ({}));
    if (data.user) {
      showApp(data.user.email);
      await refreshFiles();
    } else {
      showGuest();
    }
  } catch {
    showGuest();
    setGlobalError("Could not reach server.");
  }
})();
