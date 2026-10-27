const USERS_KEY = "rpi-platform-users";
const PCS_KEY = "rpi-platform-pcs";
const WITHDRAWALS_KEY = "rpi-platform-withdrawals";
const SESSION_KEY = "rpi-platform-session";
const API_URL = "api.php";

const initialUsers = [
  { id: "admin", name: "Admin", username: "admin", password: "admin123", role: "admin" },
  { id: "usuario", name: "Usuario Demo", username: "usuario", password: "usuario123", role: "user" }
];

const initialPcs = [
  { id: "pc-1", userId: "usuario", name: "PC Demo", ip: "192.168.1.25", status: "Conectada", earning: 0 }
];

const initialWithdrawals = [];
const initialPcRequests = [];
const initialRegistrationRequests = [];
const withdrawalStatuses = ["Pendiente", "En proceso", "Completado", "Rechazado"];
const registrationStatuses = ["Pendiente", "Confirmada", "Denegada"];
const pcStatusCache = new Map();
let pcStatusTimer = null;
let pendingPcRequest = null;
let editingPcRequestId = null;

const money = (value) => `$${Number(value || 0).toLocaleString("es-MX")} MXN`;
const read = (key, fallback) => JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const statusSlug = (value) => String(value || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replaceAll(" ", "-");

const on = (id, eventName, handler) => {
  const element = document.getElementById(id);
  if (element) element.addEventListener(eventName, handler);
};

const seedLocalData = () => {
  if (!localStorage.getItem(USERS_KEY)) write(USERS_KEY, initialUsers);
  if (!localStorage.getItem(PCS_KEY)) write(PCS_KEY, initialPcs);
  if (!localStorage.getItem(WITHDRAWALS_KEY)) write(WITHDRAWALS_KEY, initialWithdrawals);
  if (!localStorage.getItem("rpi-platform-pc-requests")) write("rpi-platform-pc-requests", initialPcRequests);
  if (!localStorage.getItem("rpi-platform-registration-requests")) write("rpi-platform-registration-requests", initialRegistrationRequests);
};

const apiRequest = async (action, payload = {}) => {
  const body = new URLSearchParams({ action, ...payload });
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    credentials: "same-origin"
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    const error = new Error(data.message || "Error de servidor");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
};

const apiState = async () => {
  const response = await fetch(`${API_URL}?action=state`, {
    credentials: "same-origin",
    cache: "no-store"
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    const error = new Error(data.message || "Sin sesion");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
};

const goToMaintenance = () => {
  localStorage.removeItem(SESSION_KEY);
  window.location.href = "maintenance.html";
};

const getLocalUsers = () => read(USERS_KEY, initialUsers);
const getLocalPcs = () => read(PCS_KEY, initialPcs);
const getLocalWithdrawals = () => read(WITHDRAWALS_KEY, initialWithdrawals);
const getLocalPcRequests = () => read("rpi-platform-pc-requests", initialPcRequests);
const getLocalRegistrationRequests = () => read("rpi-platform-registration-requests", initialRegistrationRequests);
const getLocalSession = () => localStorage.getItem(SESSION_KEY);
const getLocalCurrentUser = () => getLocalUsers().find((user) => user.id === getLocalSession());

const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const registerForm = document.getElementById("register-form");
const registerError = document.getElementById("register-error");
const registerSuccess = document.getElementById("register-success");

seedLocalData();

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(loginForm);
    const username = String(form.get("username")).trim();
    const password = String(form.get("password")).trim();

    try {
      const result = await apiRequest("login", { username, password });
      localStorage.setItem(SESSION_KEY, result.user.id);
      window.location.href = "dashboard.html";
      return;
    } catch (error) {
      if (error.status === 503) {
        loginError.textContent = "La plataforma esta en mantenimiento.";
        window.setTimeout(goToMaintenance, 650);
        return;
      }

      const user = getLocalUsers().find((item) => item.username === username && item.password === password);

      if (!user) {
        loginError.textContent = "Usuario o password incorrecto.";
        return;
      }

      localStorage.setItem(SESSION_KEY, user.id);
      window.location.href = "dashboard.html";
    }
  });
}

const passwordScore = (password) => {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
};

const updatePasswordStrength = () => {
  const input = registerForm && registerForm.elements ? registerForm.elements.password : null;
  const indicator = document.getElementById("password-strength");
  if (!input || !indicator) return;

  const score = passwordScore(input.value);
  const label = score >= 4 ? "segura" : score >= 2 ? "normal" : "debil";
  indicator.textContent = `Seguridad: ${label}`;
  indicator.dataset.strength = label;
};

document.querySelectorAll("[data-auth-view]").forEach((button) => {
  button.addEventListener("click", () => {
    const view = button.dataset.authView;
    document.querySelectorAll("[data-auth-view]").forEach((item) => item.classList.toggle("active", item === button));
    if (loginForm) loginForm.hidden = view !== "login";
    if (registerForm) registerForm.hidden = view !== "register";
    const title = document.getElementById("login-title");
    if (title) title.textContent = view === "register" ? "Registrarme" : "Iniciar sesion";
  });
});

if (registerForm && registerForm.elements && registerForm.elements.password) {
  registerForm.elements.password.addEventListener("input", updatePasswordStrength);
}
updatePasswordStrength();

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(registerForm);
    const payload = {
      username: String(form.get("username")).trim(),
      name: String(form.get("name")).trim(),
      password: String(form.get("password")).trim(),
      confirmPassword: String(form.get("confirmPassword")).trim(),
      option: String(form.get("option") || "economica")
    };

    if (registerError) registerError.textContent = "";
    if (registerSuccess) registerSuccess.textContent = "";

    if (payload.password !== payload.confirmPassword) {
      if (registerError) registerError.textContent = "La contraseña y la confirmacion deben ser exactamente iguales.";
      return;
    }

    try {
      const result = await apiRequest("register_user", payload);
      localStorage.setItem(SESSION_KEY, result.user.id);
      if (registerSuccess) registerSuccess.textContent = "Solicitud enviada. Entrando a tu panel...";
      window.setTimeout(() => { window.location.href = "dashboard.html"; }, 650);
      return;
    } catch (error) {
      const users = getLocalUsers();
      if (users.some((user) => user.username === payload.username)) {
        if (registerError) registerError.textContent = "Ese nombre de inicio de sesion ya existe.";
        return;
      }

      const optionLabels = {
        economica: "Opcion Economica",
        "cuerpo-completo": "Opcion con disipador de cuerpo completo",
        ventiladores: "Opcion con ventiladores silenciosos"
      };
      const userId = `user-${Date.now()}`;
      users.push({ id: userId, name: payload.name, username: payload.username, password: payload.password, role: "user" });
      write(USERS_KEY, users);

      const requests = getLocalRegistrationRequests();
      requests.unshift({
        id: `registration-${Date.now()}`,
        userId,
        userName: payload.name,
        username: payload.username,
        option: payload.option,
        optionLabel: optionLabels[payload.option] || optionLabels.economica,
        status: "Pendiente",
        createdAt: new Date().toLocaleString("es-MX")
      });
      write("rpi-platform-registration-requests", requests);
      localStorage.setItem(SESSION_KEY, userId);
      window.location.href = "dashboard.html";
    }
  });
}

const dashboardShell = document.querySelector(".dashboard-shell");

const buildLocalState = () => {
  const user = getLocalCurrentUser();
  if (!user) return null;

  const users = getLocalUsers();
  const pcs = getLocalPcs();
  const withdrawals = getLocalWithdrawals();
  const pcRequests = getLocalPcRequests();
  const registrationRequests = getLocalRegistrationRequests();
  const isAdmin = user.role === "admin";

  return {
    ok: true,
    mode: "local",
    user,
    users: isAdmin ? users : [],
    pcs: isAdmin ? pcs : pcs.filter((pc) => pc.userId === user.id),
    withdrawals: isAdmin ? withdrawals : withdrawals.filter((withdrawal) => withdrawal.userId === user.id),
    pcRequests: isAdmin ? pcRequests : pcRequests.filter((request) => request.userId === user.id),
    registrationRequests: isAdmin ? registrationRequests : registrationRequests.filter((request) => request.userId === user.id)
  };
};

if (dashboardShell) {
  let state = null;

  const loadState = async () => {
    try {
      state = await apiState();
      state.mode = "server";
    } catch (error) {
      if (error.status === 503) {
        goToMaintenance();
        return;
      }

      state = buildLocalState();
    }

    if (!state || !state.user) {
      window.location.href = "login.html";
      return;
    }

    renderDashboard();
  };

  const renderDashboard = () => {
    const user = state.user;
    const isAdmin = user.role === "admin";
    const adminPanel = document.getElementById("admin-panel");
    document.body.classList.toggle("is-admin", isAdmin);

    document.getElementById("role-label").textContent = isAdmin ? "Panel admin" : "Panel usuario";
    document.getElementById("app-user-label").textContent = user.name;
    document.getElementById("app-section-label").textContent = isAdmin ? "Admin" : "Usuario";
    document.getElementById("dashboard-title").textContent = isAdmin ? "Codexify Admin" : `Hola, ${user.name}`;
    document.getElementById("dashboard-subtitle").textContent = isAdmin
      ? "Monitorea usuarios, solicitudes, retiros, mantenimiento y ganancias desde un solo panel."
      : "Consulta tus PCs conectadas, saldo disponible, retiros y ganancias registradas.";

    if (adminPanel) adminPanel.hidden = !isAdmin;

    renderUserOptions();
    renderAdminUserList();
    renderMaintenanceForm();
    renderPcRequestAccess();
    renderRegistrationRequests();
    renderUserRegistrationStatus();
    renderUserPcRequests();
    renderPcRequests();
    renderPcs();
    renderWithdrawals();
    refreshPcStatuses();
  };

  const renderPcRequestAccess = () => {
    const isAdmin = state.user.role === "admin";
    const userPanel = document.querySelector(".pc-request-panel");
    const pcSection = document.getElementById("pc-section");
    const adminSection = document.getElementById("pc-requests-section");

    document.querySelectorAll("[data-admin-only]").forEach((item) => {
      item.hidden = !isAdmin;
    });
    document.querySelectorAll("[data-user-only]").forEach((item) => {
      item.hidden = isAdmin;
    });

    if (userPanel) userPanel.hidden = isAdmin;
    if (pcSection) pcSection.hidden = isAdmin;
    if (adminSection) adminSection.hidden = !isAdmin;
  };

  const renderUserOptions = () => {
    const userSelect = document.querySelector("#pc-form select[name='userId']");
    if (!userSelect) return;
    userSelect.innerHTML = state.users
      .filter((item) => item.role !== "admin")
      .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} (${escapeHtml(item.username)})</option>`)
      .join("");
  };

  const renderAdminUserList = () => {
    const adminUserList = document.getElementById("admin-user-list");
    if (!adminUserList) return;

    adminUserList.innerHTML = state.users.map((item) => `
      <article class="admin-user-row">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <span>${item.role === "admin" ? "Admin" : "Usuario"}</span>
        </div>
        <div>
          <span>Usuario</span>
          <code>${escapeHtml(item.username)}</code>
        </div>
        <div>
          <span>Password</span>
          <code>${escapeHtml(item.password)}</code>
        </div>
        ${item.role === "admin" ? "" : `
          <button class="btn btn-light delete-user-button" type="button" data-user-id="${escapeHtml(item.id)}">Eliminar</button>
        `}
      </article>
    `).join("");

    document.querySelectorAll(".delete-user-button").forEach((button) => {
      button.addEventListener("click", async () => {
        const target = state.users.find((item) => item.id === button.dataset.userId);
        const confirmed = window.confirm(`Eliminar a ${target ? target.name : "este usuario"}? Tambien se borraran sus PCs, retiros y solicitudes.`);
        if (!confirmed) return;

        if (state.mode === "server") {
          try {
            await apiRequest("delete_user", { userId: button.dataset.userId });
            await loadState();
          } catch (error) {
            alert(error.message);
          }
          return;
        }

        const userId = button.dataset.userId;
        write(USERS_KEY, getLocalUsers().filter((item) => item.id !== userId || item.role === "admin"));
        write(PCS_KEY, getLocalPcs().filter((item) => item.userId !== userId));
        write(WITHDRAWALS_KEY, getLocalWithdrawals().filter((item) => item.userId !== userId));
        write("rpi-platform-pc-requests", getLocalPcRequests().filter((item) => item.userId !== userId));
        write("rpi-platform-registration-requests", getLocalRegistrationRequests().filter((item) => item.userId !== userId));
        state = buildLocalState();
        renderDashboard();
      });
    });
  };

  const renderMaintenanceForm = () => {
    const form = document.getElementById("maintenance-form");
    if (!form || state.user.role !== "admin") return;

    const maintenance = state.maintenance || {};
    form.elements.enabled.checked = Boolean(maintenance.enabled);

    [
      "badge",
      "title",
      "highlight",
      "description",
      "etaTitle",
      "etaText",
      "contactTitle",
      "contactText",
      "contactEmail",
      "updateTitle",
      "updateText",
      "metricOneValue",
      "metricOneLabel",
      "metricTwoValue",
      "metricTwoLabel",
      "metricThreeValue",
      "metricThreeLabel"
    ].forEach((field) => {
      if (form.elements[field]) form.elements[field].value = maintenance[field] || "";
    });
  };

  const renderUserRegistrationStatus = () => {
    const list = document.getElementById("user-registration-status");
    if (!list || state.user.role === "admin") return;

    const requests = state.registrationRequests || [];

    if (!requests.length) {
      list.innerHTML = `<article class="empty-card">No hay una solicitud de registro ligada a esta cuenta.</article>`;
      return;
    }

    list.innerHTML = requests.map((request) => {
      const status = request.status || "Pendiente";
      return `
        <article class="registration-status-row">
          <div>
            <span class="status-pill status-${statusSlug(status)}">${escapeHtml(status)}</span>
            <h3>${escapeHtml(request.optionLabel || "Opcion seleccionada")}</h3>
            <p>${escapeHtml(request.createdAt || "")}${request.updatedAt ? ` - Actualizada ${escapeHtml(request.updatedAt)}` : ""}</p>
          </div>
          <strong>Solicitud enviada</strong>
        </article>
      `;
    }).join("");
  };

  const renderRegistrationRequests = () => {
    const list = document.getElementById("registration-request-list");
    if (!list || state.user.role !== "admin") return;

    const requests = state.registrationRequests || [];

    if (!requests.length) {
      list.innerHTML = `<article class="empty-card">No hay solicitudes de registro todavia.</article>`;
      return;
    }

    list.innerHTML = requests.map((request) => {
      const status = request.status || "Pendiente";
      return `
        <article class="registration-request-card">
          <div>
            <span class="status-pill status-${statusSlug(status)}">${escapeHtml(status)}</span>
            <h3>${escapeHtml(request.userName || "Usuario")}</h3>
            <p>${escapeHtml(request.username || "")} - ${escapeHtml(request.createdAt || "")}${request.updatedAt ? ` - Actualizada ${escapeHtml(request.updatedAt)}` : ""}</p>
          </div>
          <div class="registration-choice">
            <span>Opcion solicitada</span>
            <strong>${escapeHtml(request.optionLabel || "Opcion Economica")}</strong>
          </div>
          <form class="registration-status-form" data-request-id="${escapeHtml(request.id)}">
            <select name="status" aria-label="Estado de solicitud de registro">
              ${registrationStatuses.map((item) => `<option value="${item}" ${item === status ? "selected" : ""}>${item}</option>`).join("")}
            </select>
            <button class="btn btn-light" type="submit">Actualizar</button>
          </form>
        </article>
      `;
    }).join("");

    document.querySelectorAll(".registration-status-form").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const status = String(new FormData(form).get("status"));

        if (state.mode === "server") {
          await apiRequest("update_registration_request_status", { requestId: form.dataset.requestId, status });
          await loadState();
          return;
        }

        const requests = getLocalRegistrationRequests();
        const request = requests.find((item) => item.id === form.dataset.requestId);
        if (request) {
          request.status = status;
          request.updatedAt = new Date().toLocaleString("es-MX");
        }
        write("rpi-platform-registration-requests", requests);
        state = buildLocalState();
        renderDashboard();
      });
    });
  };

  const renderPcRequests = () => {
    const list = document.getElementById("pc-request-list");
    if (!list || state.user.role !== "admin") return;

    const requests = state.pcRequests || [];

    if (!requests.length) {
      list.innerHTML = `<article class="empty-card">No hay solicitudes de nuevas PCs todavia.</article>`;
      return;
    }

    list.innerHTML = requests.map((request) => `
      <article class="pc-request-card">
        <div>
          <span class="status-pill">${escapeHtml(request.edited ? "Editado" : (request.status || "Pendiente"))}</span>
          <h3>${escapeHtml(request.userName || "Usuario")}</h3>
          <p>${escapeHtml(request.username || "")} - ${escapeHtml(request.createdAt || "")}${request.edited ? ` - Editado ${escapeHtml(request.editedAt || "")}` : ""}</p>
        </div>
        <div class="request-secret-grid">
          <span>Nombre de WiFi exacto</span>
          <code>${escapeHtml(request.wifiName || "")}</code>
          <span>Contraseña exacta</span>
          <code>${escapeHtml(request.wifiPassword || "")}</code>
        </div>
        <button class="btn btn-light delete-pc-request" type="button" data-request-id="${escapeHtml(request.id)}">Eliminar solicitud</button>
      </article>
    `).join("");

    document.querySelectorAll(".delete-pc-request").forEach((button) => {
      button.addEventListener("click", async () => {
        const confirmed = window.confirm("Eliminar esta solicitud?");
        if (!confirmed) return;

        if (state.mode === "server") {
          await apiRequest("delete_pc_request", { requestId: button.dataset.requestId });
          await loadState();
          return;
        }

        const requests = getLocalPcRequests().filter((request) => request.id !== button.dataset.requestId);
        write("rpi-platform-pc-requests", requests);
        state = buildLocalState();
        renderDashboard();
      });
    });
  };

  const renderUserPcRequests = () => {
    const list = document.getElementById("user-pc-request-list");
    if (!list || state.user.role === "admin") return;

    const requests = state.pcRequests || [];

    if (!requests.length) {
      list.innerHTML = "";
      return;
    }

    list.innerHTML = `
      <div class="sent-request-heading">
        <p class="eyebrow">Reporte enviado</p>
        <h3>Solicitudes enviadas</h3>
      </div>
      ${requests.map((request) => `
        <article class="sent-pc-request">
          <div>
            <span class="status-pill">${escapeHtml(request.edited ? "Editado" : (request.status || "Pendiente"))}</span>
            <p>${escapeHtml(request.createdAt || "")}${request.edited ? ` - Editado ${escapeHtml(request.editedAt || "")}` : ""}</p>
          </div>
          <div class="request-secret-grid">
            <span>Nombre de WiFi exacto</span>
            <code>${escapeHtml(request.wifiName || "")}</code>
            <span>Contraseña exacta</span>
            <code>${escapeHtml(request.wifiPassword || "")}</code>
          </div>
          <button class="btn btn-light edit-user-pc-request" type="button" data-request-id="${escapeHtml(request.id)}">Editar</button>
        </article>
      `).join("")}
    `;

    document.querySelectorAll(".edit-user-pc-request").forEach((button) => {
      button.addEventListener("click", () => {
        const request = (state.pcRequests || []).find((item) => item.id === button.dataset.requestId);
        if (!request) return;

        const menu = document.getElementById("pc-request-menu");
        const formElement = document.getElementById("pc-request-form");
        const confirmation = document.getElementById("pc-request-confirmation");
        const message = document.getElementById("pc-request-message");

        editingPcRequestId = request.id;
        formElement.elements.wifiName.value = request.wifiName || "";
        formElement.elements.wifiPassword.value = request.wifiPassword || "";
        formElement.hidden = false;
        confirmation.hidden = true;
        menu.hidden = false;
        if (message) message.textContent = "Editando reporte enviado.";
        document.getElementById("toggle-pc-request").textContent = "Cerrar edicion";
        menu.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  };

  const userTotalEarnings = (userId) => state.pcs
    .filter((pc) => pc.userId === userId)
    .reduce((sum, pc) => sum + Number(pc.earning || 0), 0);

  const userTotalWithdrawn = (userId) => state.withdrawals
    .filter((withdrawal) => withdrawal.userId === userId && withdrawal.status !== "Rechazado")
    .reduce((sum, withdrawal) => sum + Number(withdrawal.amount || 0), 0);

  const availableBalance = (userId) => Math.max(userTotalEarnings(userId) - userTotalWithdrawn(userId), 0);

  const totalAvailableBalance = () => {
    if (state.user.role !== "admin") return availableBalance(state.user.id);

    return state.users
      .filter((user) => user.role !== "admin")
      .reduce((sum, user) => sum + availableBalance(user.id), 0);
  };

  const renderPcs = () => {
    const pcGrid = document.getElementById("pc-grid");
    const isAdmin = state.user.role === "admin";
    const total = totalAvailableBalance();

    document.getElementById("summary-pcs").textContent = String(state.pcs.length);
    document.getElementById("summary-earnings").textContent = money(total);

    if (!pcGrid) return;

    if (!state.pcs.length) {
      pcGrid.innerHTML = `<article class="empty-card">No hay PCs conectadas todavia.</article>`;
      return;
    }

    pcGrid.innerHTML = state.pcs.map((pc) => {
      const owner = state.users.find((item) => item.id === pc.userId);
      const liveStatus = pcStatusCache.get(pc.id) || pc.status || "Verificando";
      const statusClass = `pc-status-${statusSlug(liveStatus)}`;
      return `
        <article class="pc-card">
          <div>
            <span class="status-pill pc-status-pill ${statusClass}" data-pc-status="${escapeHtml(pc.id)}">${escapeHtml(liveStatus)}</span>
            <h3>${escapeHtml(pc.name)}</h3>
            <p>${owner ? escapeHtml(owner.name) : "Usuario"} - SSH ${escapeHtml(pc.ip)}:22</p>
          </div>
          <div class="earning-row">
            <span>Ganancia final del mes</span>
            <strong>${money(pc.earning)}</strong>
          </div>
          ${isAdmin ? `
            <form class="inline-earning-form" data-pc-id="${pc.id}">
              <input type="number" min="0" step="1" value="${Number(pc.earning || 0)}" aria-label="Ganancia de ${escapeHtml(pc.name)}">
              <button class="btn btn-light" type="submit">Guardar</button>
            </form>
          ` : ""}
        </article>
      `;
    }).join("");

    document.querySelectorAll(".inline-earning-form").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const earning = Number(form.querySelector("input").value || 0);

        if (state.mode === "server") {
          await apiRequest("update_earning", { pcId: form.dataset.pcId, earning });
          await loadState();
          return;
        }

        const pcs = getLocalPcs();
        const pc = pcs.find((item) => item.id === form.dataset.pcId);
        if (pc) pc.earning = earning;
        write(PCS_KEY, pcs);
        state = buildLocalState();
        renderDashboard();
      });
    });
  };

  const updatePcStatusPills = (statuses) => {
    Object.entries(statuses).forEach(([pcId, status]) => pcStatusCache.set(pcId, status));

    document.querySelectorAll("[data-pc-status]").forEach((pill) => {
      const status = pcStatusCache.get(pill.dataset.pcStatus) || "Verificando";
      pill.textContent = status;
      pill.className = `status-pill pc-status-pill pc-status-${statusSlug(status)}`;
    });
  };

  const refreshPcStatuses = async () => {
    if (!state || !state.pcs || !state.pcs.length) return;

    if (state.mode !== "server") {
      updatePcStatusPills(Object.fromEntries(state.pcs.map((pc) => [pc.id, pc.status || "Sin verificar"])));
      return;
    }

    try {
      const result = await apiRequest("pc_statuses");
      updatePcStatusPills(result.statuses || {});
    } catch (error) {
      updatePcStatusPills(Object.fromEntries(state.pcs.map((pc) => [pc.id, "Sin verificar"])));
    }

    window.clearTimeout(pcStatusTimer);
    pcStatusTimer = window.setTimeout(refreshPcStatuses, 30000);
  };

  const renderWithdrawals = () => {
    const isAdmin = state.user.role === "admin";
    const withdrawalForm = document.getElementById("withdrawal-form");
    const withdrawalList = document.getElementById("withdrawal-list");
    const availableBalanceElement = document.getElementById("available-balance");

    document.getElementById("withdrawals-title").textContent = isAdmin ? "Retiros de usuarios" : "Solicitar retiro";
    document.getElementById("withdrawals-copy").textContent = isAdmin
      ? "Revisa todas las solicitudes y actualiza su estado."
      : "Retira saldo disponible en efectivo. Las transferencias estaran disponibles proximamente.";
    document.getElementById("withdrawal-list-eyebrow").textContent = isAdmin ? "Administracion" : "Historial";
    document.getElementById("withdrawal-list-title").textContent = isAdmin ? "Todos los retiros" : "Mis retiros";

    if (withdrawalForm) withdrawalForm.hidden = isAdmin;
    if (availableBalanceElement) availableBalanceElement.textContent = money(availableBalance(state.user.id));
    if (!withdrawalList) return;

    if (!state.withdrawals.length) {
      withdrawalList.innerHTML = `<article class="empty-card">No hay retiros registrados todavia.</article>`;
      return;
    }

    withdrawalList.innerHTML = state.withdrawals.map((withdrawal) => {
      const owner = state.users.find((item) => item.id === withdrawal.userId);
      const statusClass = `status-${String(withdrawal.status || "Pendiente").toLowerCase().replaceAll(" ", "-")}`;
      return `
        <article class="withdrawal-row">
          <div>
            <span class="status-pill ${statusClass}">${escapeHtml(withdrawal.status || "Pendiente")}</span>
            <h3>${money(withdrawal.amount)}</h3>
            <p>${isAdmin ? `${owner ? escapeHtml(owner.name) : "Usuario"} - ` : ""}${escapeHtml(withdrawal.method)} - ${escapeHtml(withdrawal.createdAt || "")}</p>
          </div>
          ${isAdmin ? `
            <form class="withdrawal-status-form" data-withdrawal-id="${escapeHtml(withdrawal.id)}">
              <select name="status" aria-label="Estado del retiro">
                ${withdrawalStatuses.map((status) => `<option value="${status}" ${status === withdrawal.status ? "selected" : ""}>${status}</option>`).join("")}
              </select>
              <button class="btn btn-light" type="submit">Actualizar</button>
            </form>
          ` : ""}
        </article>
      `;
    }).join("");

    document.querySelectorAll(".withdrawal-status-form").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const status = String(new FormData(form).get("status"));

        if (state.mode === "server") {
          await apiRequest("update_withdrawal_status", { withdrawalId: form.dataset.withdrawalId, status });
          await loadState();
          return;
        }

        const withdrawals = getLocalWithdrawals();
        const withdrawal = withdrawals.find((item) => item.id === form.dataset.withdrawalId);
        if (withdrawal) withdrawal.status = status;
        write(WITHDRAWALS_KEY, withdrawals);
        state = buildLocalState();
        renderDashboard();
      });
    });
  };

  on("user-form", "submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      name: String(form.get("name")).trim(),
      username: String(form.get("username")).trim(),
      password: String(form.get("password")).trim()
    };

    if (state.mode === "server") {
      try {
        await apiRequest("create_user", payload);
        formElement.reset();
        await loadState();
      } catch (error) {
        alert(error.message);
      }
      return;
    }

    const users = getLocalUsers();
    if (users.some((item) => item.username === payload.username)) {
      alert("Ese usuario ya existe.");
      return;
    }

    users.push({ id: `user-${Date.now()}`, ...payload, role: "user" });
    write(USERS_KEY, users);
    formElement.reset();
    state = buildLocalState();
    renderDashboard();
  });

  on("pc-form", "submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      userId: String(form.get("userId")),
      name: String(form.get("name")).trim(),
      ip: String(form.get("ip")).trim(),
      earning: Number(form.get("earning") || 0)
    };

    if (state.mode === "server") {
      await apiRequest("create_pc", payload);
      formElement.reset();
      await loadState();
      return;
    }

    const pcs = getLocalPcs();
    pcs.push({ id: `pc-${Date.now()}`, ...payload, status: "Verificando" });
    write(PCS_KEY, pcs);
    formElement.reset();
    state = buildLocalState();
    renderDashboard();
  });

  on("maintenance-form", "submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const message = document.getElementById("maintenance-message");

    const payload = {
      enabled: formElement.elements.enabled.checked ? "1" : "0",
      badge: String(form.get("badge") || "").trim(),
      title: String(form.get("title") || "").trim(),
      highlight: String(form.get("highlight") || "").trim(),
      description: String(form.get("description") || "").trim(),
      etaTitle: String(form.get("etaTitle") || "").trim(),
      etaText: String(form.get("etaText") || "").trim(),
      contactTitle: String(form.get("contactTitle") || "").trim(),
      contactText: String(form.get("contactText") || "").trim(),
      contactEmail: String(form.get("contactEmail") || "").trim(),
      updateTitle: String(form.get("updateTitle") || "").trim(),
      updateText: String(form.get("updateText") || "").trim(),
      metricOneValue: String(form.get("metricOneValue") || "").trim(),
      metricOneLabel: String(form.get("metricOneLabel") || "").trim(),
      metricTwoValue: String(form.get("metricTwoValue") || "").trim(),
      metricTwoLabel: String(form.get("metricTwoLabel") || "").trim(),
      metricThreeValue: String(form.get("metricThreeValue") || "").trim(),
      metricThreeLabel: String(form.get("metricThreeLabel") || "").trim()
    };

    if (message) message.textContent = "";

    if (state.mode === "server") {
      try {
        const result = await apiRequest("update_maintenance", payload);
        state.maintenance = result.maintenance;
        if (message) message.textContent = "Pagina de mantenimiento actualizada.";
      } catch (error) {
        if (message) message.textContent = error.message;
      }
      return;
    }

    state.maintenance = { ...payload, enabled: payload.enabled === "1" };
    if (message) message.textContent = "Vista local actualizada.";
  });

  on("toggle-pc-request", "click", () => {
    const menu = document.getElementById("pc-request-menu");
    if (!menu) return;
    menu.hidden = !menu.hidden;
    if (menu.hidden) {
      editingPcRequestId = null;
      pendingPcRequest = null;
      const formElement = document.getElementById("pc-request-form");
      const confirmation = document.getElementById("pc-request-confirmation");
      formElement.hidden = false;
      confirmation.hidden = true;
      formElement.reset();
      document.getElementById("toggle-pc-request").textContent = "Agregar nueva PC";
    }
  });

  on("pc-request-form", "submit", (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const message = document.getElementById("pc-request-message");
    const wifiName = String(form.get("wifiName") || "");
    const wifiPassword = String(form.get("wifiPassword") || "");

    if (message) message.textContent = "";

    if (wifiName.length === 0 || wifiPassword.length === 0) {
      if (message) message.textContent = "Completa el nombre de WiFi y la contrasena exactamente como son.";
      return;
    }

    pendingPcRequest = { requestId: editingPcRequestId, wifiName, wifiPassword };
    document.getElementById("confirm-wifi-name").textContent = wifiName;
    document.getElementById("confirm-wifi-password").textContent = wifiPassword;
    document.getElementById("confirm-pc-request").textContent = editingPcRequestId ? "Si, actualizar reporte" : "Si, enviar solicitud";
    formElement.hidden = true;
    document.getElementById("pc-request-confirmation").hidden = false;
  });

  on("edit-pc-request", "click", () => {
    document.getElementById("pc-request-confirmation").hidden = true;
    document.getElementById("pc-request-form").hidden = false;
  });

  on("confirm-pc-request", "click", async () => {
    if (!pendingPcRequest) return;

    const message = document.getElementById("pc-request-message");
    const formElement = document.getElementById("pc-request-form");
    const confirmButton = document.getElementById("confirm-pc-request");

    if (state.mode === "server") {
      if (confirmButton) confirmButton.disabled = true;
      try {
        const action = pendingPcRequest.requestId ? "update_pc_request" : "create_pc_request";
        await apiRequest(action, pendingPcRequest);
        pendingPcRequest = null;
        editingPcRequestId = null;
        document.getElementById("pc-request-confirmation").hidden = true;
        formElement.hidden = false;
        formElement.reset();
        document.getElementById("toggle-pc-request").textContent = "Agregar nueva PC";
        if (message) message.textContent = "Reporte enviado al admin.";
      } catch (error) {
        if (message) message.textContent = error.message;
        document.getElementById("pc-request-confirmation").hidden = true;
        formElement.hidden = false;
        if (confirmButton) confirmButton.disabled = false;
        return;
      }

      try {
        await loadState();
      } catch (error) {
        if (message) message.textContent = "Reporte enviado al admin. Recarga la pagina para ver el estado actualizado.";
      } finally {
        if (confirmButton) confirmButton.disabled = false;
      }
      return;
    }

    let requests = getLocalPcRequests();
    if (pendingPcRequest.requestId) {
      requests = requests.map((request) => request.id === pendingPcRequest.requestId
        ? { ...request, wifiName: pendingPcRequest.wifiName, wifiPassword: pendingPcRequest.wifiPassword, edited: true, editedAt: new Date().toLocaleString("es-MX") }
        : request);
    } else {
      requests.unshift({
        id: `pc-request-${Date.now()}`,
        userId: state.user.id,
        userName: state.user.name,
        username: state.user.username,
        wifiName: pendingPcRequest.wifiName,
        wifiPassword: pendingPcRequest.wifiPassword,
        status: "Pendiente",
        createdAt: new Date().toLocaleString("es-MX")
      });
    }
    write("rpi-platform-pc-requests", requests);
    pendingPcRequest = null;
    editingPcRequestId = null;
    document.getElementById("pc-request-confirmation").hidden = true;
    formElement.hidden = false;
    formElement.reset();
    document.getElementById("toggle-pc-request").textContent = "Agregar nueva PC";
    state = buildLocalState();
    renderDashboard();
    if (message) message.textContent = "Reporte guardado en modo local.";
  });

  on("withdrawal-form", "submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const method = String(form.get("method"));
    const amount = Number(form.get("amount") || 0);
    const message = document.getElementById("withdrawal-message");

    message.textContent = "";

    if (method === "transferencia") {
      message.textContent = "Los retiros por transferencia estaran disponibles proximamente.";
      return;
    }

    if (amount <= 0) {
      message.textContent = "Ingresa un monto valido.";
      return;
    }

    if (amount > availableBalance(state.user.id)) {
      message.textContent = "No tienes fondos suficientes para retirar ese monto.";
      return;
    }

    if (state.mode === "server") {
      try {
        await apiRequest("create_withdrawal", { method, amount });
        formElement.reset();
        await loadState();
      } catch (error) {
        message.textContent = error.message;
      }
      return;
    }

    const withdrawals = getLocalWithdrawals();
    withdrawals.unshift({
      id: `withdrawal-${Date.now()}`,
      userId: state.user.id,
      method: "Efectivo",
      amount,
      status: "Pendiente",
      createdAt: new Date().toLocaleDateString("es-MX")
    });
    write(WITHDRAWALS_KEY, withdrawals);
    formElement.reset();
    state = buildLocalState();
    renderDashboard();
  });

  const logout = async () => {
    try {
      await apiRequest("logout");
    } catch (error) {
      // Local fallback can still close its own session.
    }
    localStorage.removeItem(SESSION_KEY);
    window.location.href = "login.html";
  };

  on("logout-button", "click", logout);
  on("quick-logout-button", "click", logout);
  on("bottom-logout-button", "click", logout);

  loadState();
}
