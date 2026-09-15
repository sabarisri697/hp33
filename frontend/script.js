const API = (window.location.origin.includes(":8000") || (window.location.protocol === "http:" && window.location.pathname.startsWith("/api")))
  ? "/api"
  : "http://127.0.0.1:8000/api";
const TOKEN_KEY = "ems_token";

const state = {
  user: null,
  events: [],
  bookings: [],
  users: [],
};

const els = {
  authScreen: document.getElementById("auth-screen"),
  appShell: document.getElementById("app-shell"),
  sidebar: document.getElementById("sidebar"),
};

function toast(message) {
  const stack = document.getElementById("toast-stack");
  const item = document.createElement("div");
  item.className = "toast";
  item.textContent = message;
  stack.appendChild(item);
  setTimeout(() => item.remove(), 3200);
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function errorMessage(data, fallback) {
  if (!data) return fallback;
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail.map((item) => item.msg || JSON.stringify(item)).join("; ");
  }
  return fallback;
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = localStorage.getItem(TOKEN_KEY);
  if (!(options.body instanceof FormData) && options.body && typeof options.body === "object") {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(`${API}${path}`, { ...options, headers });
  } catch {
    throw new Error(`Unable to connect to backend at ${API}. Make sure backend server is running.`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text };
    }
  }
  if (!response.ok) {
    const err = new Error(errorMessage(data, "Request failed"));
    err.status = response.status;
    throw err;
  }
  return data;
}

async function downloadFile(path, filename) {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Export failed");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function initials(name) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
}

function showApp() {
  els.authScreen.classList.add("hidden");
  els.appShell.classList.remove("hidden");
}

function showAuth() {
  els.appShell.classList.add("hidden");
  els.authScreen.classList.remove("hidden");
}

function applyRoleUi() {
  const role = state.user.role;
  document.querySelectorAll(".admin-only").forEach((el) => {
    el.style.display = role === "admin" ? "" : "none";
  });
  document.querySelectorAll(".staff-only").forEach((el) => {
    el.style.display = role === "admin" || role === "organizer" ? "" : "none";
  });
  document.getElementById("user-display-name").textContent = state.user.full_name;
  document.getElementById("user-display-role").textContent = role;
  document.getElementById("user-avatar").textContent = initials(state.user.full_name);
  document.getElementById("welcome-title").textContent = `Welcome, ${state.user.full_name}`;
}

function switchSection(id) {
  document.querySelectorAll(".nav-link").forEach((link) => link.classList.toggle("active", link.dataset.target === id));
  document.querySelectorAll(".app-section").forEach((section) => section.classList.toggle("active", section.id === id));
  const active = document.querySelector(`.nav-link[data-target="${id}"]`);
  document.getElementById("page-title").textContent = active ? active.textContent : "Dashboard";
  els.sidebar.classList.remove("open");
}

async function loadAll() {
  const [events, bookings, stats, activity] = await Promise.all([
    api("/events?timeframe=all"),
    api("/bookings"),
    api("/dashboard/stats"),
    api("/dashboard/activity"),
  ]);
  state.events = events;
  state.bookings = bookings;
  renderStats(stats);
  renderActivity(activity);
  renderDashboard();
  renderCatalog();
  renderBookings();
  fillVenueFilter();
  if (state.user.role === "admin" || state.user.role === "organizer") {
    await renderAttendees();
    await renderReports();
  }
  if (state.user.role === "admin") await renderUsers();
}

function renderStats(stats) {
  document.getElementById("stat-total-events").textContent = stats.total_events;
  document.getElementById("stat-total-bookings").textContent = stats.total_bookings;
  document.getElementById("stat-active-users").textContent = stats.registered_users;
  document.getElementById("stat-venues").textContent = stats.active_venues;
  document.getElementById("stat-occupancy").textContent = `${stats.avg_occupancy}%`;
  document.getElementById("stat-popular").textContent = stats.most_popular_event || "—";
}

function renderActivity(items) {
  const feed = document.getElementById("activity-feed");
  feed.innerHTML = items.length
    ? items.map((item) => `<li><strong>${esc(item.kind)}</strong> ${esc(item.message)}</li>`).join("")
    : "<li>No recent activity.</li>";
}

function canManage(event) {
  return state.user.role === "admin" || event.organizer_id === state.user.id;
}

function renderDashboard() {
  const body = document.getElementById("dashboard-events-tbody");
  const rows = state.events.filter((event) => event.is_upcoming).slice(0, 6);
  body.innerHTML = rows.length
    ? rows.map((event) => `
      <tr>
        <td><strong>${esc(event.title)}</strong></td>
        <td>${esc(event.category)}</td>
        <td>${esc(event.date)} ${esc(event.time)}</td>
        <td>${esc(event.venue)}</td>
        <td>${event.registered}/${event.capacity}</td>
        <td>${actionButtons(event)}</td>
      </tr>`).join("")
    : `<tr><td colspan="6">No upcoming events yet.</td></tr>`;
}

function actionButtons(event) {
  if (canManage(event)) {
    return `<button class="btn-text" data-edit="${event.id}">Edit</button>
            <button class="btn-text" data-delete="${event.id}">Delete</button>`;
  }
  return `<button class="btn-text" data-book="${event.id}">Book</button>`;
}

function fillVenueFilter() {
  const select = document.getElementById("venue-filter");
  const venues = [...new Set(state.events.map((event) => event.venue))];
  const current = select.value || "All";
  select.innerHTML = `<option value="All">All</option>` + venues.map((venue) => `<option>${esc(venue)}</option>`).join("");
  select.value = current;
}

function renderCatalog() {
  const search = document.getElementById("search-input").value.toLowerCase();
  const category = document.getElementById("category-filter").value;
  const venue = document.getElementById("venue-filter").value;
  const date = document.getElementById("date-filter").value;
  const timeframe = document.getElementById("timeframe-filter").value;
  const grid = document.getElementById("events-card-grid");

  const filtered = state.events.filter((event) => {
    const hay = `${event.title} ${event.venue} ${event.category}`.toLowerCase();
    const matchesSearch = !search || hay.includes(search);
    const matchesCategory = category === "All" || event.category === category;
    const matchesVenue = venue === "All" || event.venue === venue;
    const matchesDate = !date || event.date === date;
    const matchesTime = timeframe === "all" || (timeframe === "upcoming" ? event.is_upcoming : !event.is_upcoming);
    return matchesSearch && matchesCategory && matchesVenue && matchesDate && matchesTime;
  });

  if (!filtered.length) {
    grid.innerHTML = `<div class="card">No events match these filters.</div>`;
    return;
  }

  grid.innerHTML = filtered.map((event) => {
    const full = event.registered >= event.capacity;
    const booked = state.bookings.some((booking) => booking.event_id === event.id);
    let cta = `<button class="btn btn-primary btn-block" data-book="${event.id}">Book seat</button>`;
    if (!event.is_upcoming) cta = `<button class="btn btn-secondary btn-block" disabled>Past event</button>`;
    else if (event.status === "cancelled") cta = `<button class="btn btn-secondary btn-block" disabled>Cancelled</button>`;
    else if (full) cta = `<button class="btn btn-secondary btn-block" disabled>Fully booked</button>`;
    else if (booked) cta = `<button class="btn btn-secondary btn-block" disabled>Already booked</button>`;
    return `
      <article class="card event-card">
        <span class="tag">${esc(event.category)}</span>
        <h4>${esc(event.title)}</h4>
        <ul>
          <li>${esc(event.date)} at ${esc(event.time)}</li>
          <li>${esc(event.venue)}</li>
          <li>${event.registered}/${event.capacity} seats</li>
        </ul>
        ${cta}
        ${canManage(event) ? `<div class="card-actions">${actionButtons(event)}</div>` : ""}
      </article>`;
  }).join("");
}

function renderBookings() {
  const body = document.getElementById("user-bookings-tbody");
  body.innerHTML = state.bookings.length
    ? state.bookings.map((booking) => `
      <tr>
        <td><code>${esc(booking.confirmation_code)}</code></td>
        <td>${esc(booking.event_title)}</td>
        <td>${esc(booking.date)} ${esc(booking.time)}</td>
        <td>${esc(booking.venue)}</td>
        <td><span class="badge ${booking.status === "Confirmed" ? "badge-ok" : "badge-warn"}">${booking.status}</span></td>
        <td><button class="btn-text" data-cancel="${booking.id}">Cancel</button></td>
      </tr>`).join("")
    : `<tr><td colspan="6">You have not booked any events yet.</td></tr>`;
}

async function renderAttendees() {
  const select = document.getElementById("attendee-event-select");
  const previous = select.value;
  const visible = state.events.filter((event) => canManage(event));
  select.innerHTML = visible.map((event) => `<option value="${event.id}">${esc(event.title)} (${esc(event.date)})</option>`).join("");
  if (previous) select.value = previous;
  await loadRoster();
}

async function loadRoster() {
  const eventId = document.getElementById("attendee-event-select").value;
  const title = document.getElementById("selected-event-roster-title");
  const body = document.getElementById("attendee-roster-tbody");
  if (!eventId) {
    body.innerHTML = `<tr><td colspan="6">No events available.</td></tr>`;
    return;
  }
  const event = state.events.find((item) => String(item.id) === String(eventId));
  title.textContent = event ? `Attendee roster: ${event.title}` : "Attendee roster";
  try {
    const attendees = await api(`/events/${eventId}/attendees`);
    body.innerHTML = attendees.length
      ? attendees.map((person) => `
        <tr>
          <td><code>${esc(person.confirmation_code)}</code></td>
          <td>${esc(person.full_name)}</td>
          <td>${esc(person.email)}</td>
          <td>${esc(person.role)}</td>
          <td>${person.registration_date.slice(0, 10)}</td>
          <td><button class="btn-text" data-remove-reg="${person.registration_id}">Remove</button></td>
        </tr>`).join("")
      : `<tr><td colspan="6">No registered attendees yet.</td></tr>`;
  } catch (err) {
    body.innerHTML = `<tr><td colspan="6">${err.message}</td></tr>`;
  }
}

async function renderReports() {
  const rows = await api("/reports/events");
  document.getElementById("reports-tbody").innerHTML = rows.map((row) => `
    <tr>
      <td>${row.event_id}</td>
      <td>${esc(row.title)}</td>
      <td>${esc(row.category)}</td>
      <td>${row.capacity}</td>
      <td>${row.registered}</td>
      <td>${row.occupancy_rate}%</td>
      <td>${row.status}</td>
    </tr>`).join("");
}

async function renderUsers() {
  const q = document.getElementById("user-search").value;
  state.users = await api(`/users${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  document.getElementById("users-tbody").innerHTML = state.users.map((user) => `
    <tr>
      <td>${esc(user.full_name)}</td>
      <td>${esc(user.username)}</td>
      <td>${esc(user.email)}</td>
      <td><span class="badge badge-muted">${esc(user.role)}</span></td>
      <td>
        <button class="btn-text" data-edit-user="${user.id}">Edit</button>
        <button class="btn-text" data-delete-user="${user.id}">Delete</button>
      </td>
    </tr>`).join("");
}

function openEventModal(event) {
  document.getElementById("event-error").textContent = "";
  document.getElementById("event-form").reset();
  document.getElementById("status-field").classList.toggle("hidden", !event);
  if (event) {
    document.getElementById("modal-event-title").textContent = "Edit event";
    document.getElementById("event-id").value = event.id;
    document.getElementById("form-title").value = event.title;
    document.getElementById("form-category").value = event.category;
    document.getElementById("form-capacity").value = event.capacity;
    document.getElementById("form-date").value = event.date;
    document.getElementById("form-time").value = event.time;
    document.getElementById("form-venue").value = event.venue;
    document.getElementById("form-status").value = event.status;
  } else {
    document.getElementById("modal-event-title").textContent = "Create event";
    document.getElementById("event-id").value = "";
  }
  document.getElementById("event-modal").classList.add("active");
}

function openUserModal(user) {
  document.getElementById("user-error").textContent = "";
  document.getElementById("user-form").reset();
  const editing = Boolean(user);
  document.getElementById("modal-user-title").textContent = editing ? "Edit student" : "Add student";
  document.getElementById("username-field").classList.toggle("hidden", editing);
  document.getElementById("user-username").required = !editing;
  document.getElementById("password-field").querySelector("input").required = !editing;
  if (user) {
    document.getElementById("user-id").value = user.id;
    document.getElementById("user-fullname").value = user.full_name;
    document.getElementById("user-email").value = user.email;
    document.getElementById("user-role").value = user.role;
  } else {
    document.getElementById("user-id").value = "";
  }
  document.getElementById("user-modal").classList.add("active");
}

document.getElementById("tab-login").addEventListener("click", () => {
  document.getElementById("tab-login").classList.add("active");
  document.getElementById("tab-register").classList.remove("active");
  document.getElementById("login-form").classList.add("active");
  document.getElementById("register-form").classList.remove("active");
});

document.getElementById("tab-register").addEventListener("click", () => {
  document.getElementById("tab-register").classList.add("active");
  document.getElementById("tab-login").classList.remove("active");
  document.getElementById("register-form").classList.add("active");
  document.getElementById("login-form").classList.remove("active");
});

document.querySelectorAll(".demo-login-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.getElementById("login-username").value = btn.dataset.user;
    document.getElementById("login-password").value = btn.dataset.pass;
    document.getElementById("login-form").requestSubmit();
  });
});

document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = document.getElementById("login-error");
  error.textContent = "";
  try {
    const data = await api("/auth/login", {
      method: "POST",
      body: {
        username: document.getElementById("login-username").value,
        password: document.getElementById("login-password").value,
      },
    });
    localStorage.setItem(TOKEN_KEY, data.access_token);
    state.user = data.user;
    showApp();
    applyRoleUi();
    await loadAll();
  } catch (err) {
    error.textContent = err.message;
  }
});

document.getElementById("register-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = document.getElementById("register-error");
  error.textContent = "";
  try {
    await api("/auth/register", {
      method: "POST",
      body: {
        full_name: document.getElementById("reg-fullname").value,
        username: document.getElementById("reg-username").value,
        email: document.getElementById("reg-email").value,
        password: document.getElementById("reg-password").value,
        role: document.getElementById("reg-role").value,
      },
    });
    toast("Account created. You can sign in now.");
    document.getElementById("tab-login").click();
    document.getElementById("login-username").value = document.getElementById("reg-username").value;
  } catch (err) {
    error.textContent = err.message;
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.removeItem(TOKEN_KEY);
  state.user = null;
  showAuth();
});

document.getElementById("menu-toggle").addEventListener("click", () => els.sidebar.classList.toggle("open"));
document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    switchSection(link.dataset.target);
  });
});
document.querySelector("[data-goto]").addEventListener("click", () => switchSection("catalog-section"));

["search-input", "category-filter", "venue-filter", "date-filter", "timeframe-filter"].forEach((id) => {
  document.getElementById(id).addEventListener("input", renderCatalog);
});
document.getElementById("reset-filters-btn").addEventListener("click", () => {
  document.getElementById("search-input").value = "";
  document.getElementById("category-filter").value = "All";
  document.getElementById("venue-filter").value = "All";
  document.getElementById("date-filter").value = "";
  document.getElementById("timeframe-filter").value = "all";
  renderCatalog();
});

document.getElementById("open-create-modal").addEventListener("click", () => openEventModal(null));
document.getElementById("close-event-modal").addEventListener("click", () => document.getElementById("event-modal").classList.remove("active"));
document.getElementById("cancel-event-modal").addEventListener("click", () => document.getElementById("event-modal").classList.remove("active"));
document.getElementById("open-user-modal").addEventListener("click", () => openUserModal(null));
document.getElementById("close-user-modal").addEventListener("click", () => document.getElementById("user-modal").classList.remove("active"));
document.getElementById("cancel-user-modal").addEventListener("click", () => document.getElementById("user-modal").classList.remove("active"));

document.getElementById("event-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = document.getElementById("event-error");
  error.textContent = "";
  const id = document.getElementById("event-id").value;
  const payload = {
    title: document.getElementById("form-title").value,
    category: document.getElementById("form-category").value,
    capacity: Number(document.getElementById("form-capacity").value),
    date: document.getElementById("form-date").value,
    time: document.getElementById("form-time").value,
    venue: document.getElementById("form-venue").value,
  };
  if (id) payload.status = document.getElementById("form-status").value;
  try {
    await api(id ? `/events/${id}` : "/events", { method: id ? "PUT" : "POST", body: payload });
    document.getElementById("event-modal").classList.remove("active");
    toast(id ? "Event updated" : "Event created");
    await loadAll();
  } catch (err) {
    error.textContent = err.message;
  }
});

document.getElementById("user-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = document.getElementById("user-error");
  error.textContent = "";
  const id = document.getElementById("user-id").value;
  try {
    if (id) {
      const payload = {
        full_name: document.getElementById("user-fullname").value,
        email: document.getElementById("user-email").value,
        role: document.getElementById("user-role").value,
      };
      const password = document.getElementById("user-password").value;
      if (password) payload.password = password;
      await api(`/users/${id}`, { method: "PUT", body: payload });
    } else {
      await api("/users", {
        method: "POST",
        body: {
          full_name: document.getElementById("user-fullname").value,
          username: document.getElementById("user-username").value,
          email: document.getElementById("user-email").value,
          role: document.getElementById("user-role").value,
          password: document.getElementById("user-password").value,
        },
      });
    }
    document.getElementById("user-modal").classList.remove("active");
    toast("Student saved");
    await renderUsers();
  } catch (err) {
    error.textContent = err.message;
  }
});

document.getElementById("user-search").addEventListener("input", () => {
  renderUsers().catch((err) => toast(err.message));
});

document.getElementById("attendee-event-select").addEventListener("change", loadRoster);
document.getElementById("export-attendees-btn").addEventListener("click", async () => {
  const eventId = document.getElementById("attendee-event-select").value;
  try {
    await downloadFile(`/events/${eventId}/attendees/export`, `attendees-event-${eventId}.csv`);
  } catch (err) {
    toast(err.message);
  }
});
document.getElementById("export-report-btn").addEventListener("click", async () => {
  try {
    await downloadFile("/reports/events/export", "event-reports.csv");
  } catch (err) {
    toast(err.message);
  }
});

document.body.addEventListener("click", async (event) => {
  const bookId = event.target.dataset.book;
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;
  const cancelId = event.target.dataset.cancel;
  const removeReg = event.target.dataset.removeReg;
  const deleteUser = event.target.dataset.deleteUser;
  const editUser = event.target.dataset.editUser;
  try {
    if (bookId) {
      const booking = await api(`/events/${bookId}/register`, { method: "POST" });
      toast(`Booked. Code: ${booking.confirmation_code}`);
      await loadAll();
    }
    if (editId) {
      const found = state.events.find((item) => String(item.id) === String(editId));
      if (found) openEventModal(found);
    }
    if (deleteId && confirm("Delete this event?")) {
      await api(`/events/${deleteId}`, { method: "DELETE" });
      toast("Event deleted");
      await loadAll();
    }
    if (cancelId && confirm("Cancel this booking?")) {
      await api(`/bookings/${cancelId}`, { method: "DELETE" });
      toast("Booking cancelled");
      await loadAll();
    }
    if (removeReg && confirm("Remove this participant?")) {
      await api(`/bookings/${removeReg}`, { method: "DELETE" });
      toast("Participant removed");
      await loadAll();
    }
    if (deleteUser && confirm("Delete this account?")) {
      await api(`/users/${deleteUser}`, { method: "DELETE" });
      toast("Account deleted");
      await renderUsers();
    }
    if (editUser) {
      const found = (state.users || []).find((item) => String(item.id) === String(editUser));
      if (found) openUserModal(found);
    }
  } catch (err) {
    toast(err.message);
  }
});

async function boot() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    showAuth();
    return;
  }
  try {
    state.user = await api("/auth/me");
    showApp();
    applyRoleUi();
    await loadAll();
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    showAuth();
  }
}

boot();
