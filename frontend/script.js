/**
 * Campus Event Management System - Single Page Frontend
 */

// Stock Unsplash Banner URLs for Dynamic Event Category Backgrounds
const categoryBanners = {
  Technology: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=600&auto=format&fit=crop",
  Sports: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=600&auto=format&fit=crop",
  Academic: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=600&auto=format&fit=crop",
  Cultural: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600&auto=format&fit=crop"
};

let mockEvents = [
  { id: 101, title: "Annual Tech Symposium", category: "Technology", date: "2026-03-15", time: "10:00", venue: "Main Auditorium", capacity: 150, registered: 120 },
  { id: 102, title: "Inter-College Chess Championship", category: "Sports", date: "2026-03-20", time: "09:00", venue: "Hall B", capacity: 50, registered: 42 },
  { id: 103, title: "Guest Lecture: AI in Healthcare", category: "Academic", date: "2026-03-25", time: "14:00", venue: "Science Block", capacity: 80, registered: 80 },
  { id: 104, title: "Spring Cultural Festival", category: "Cultural", date: "2026-04-02", time: "17:00", venue: "Campus Ground", capacity: 300, registered: 106 }
];

let mockBookings = [
  { ticketCode: "TICK-8821", eventId: 101, eventTitle: "Annual Tech Symposium", date: "2026-03-15", venue: "Main Auditorium", status: "Confirmed" },
  { ticketCode: "TICK-4309", eventId: 103, eventTitle: "Guest Lecture: AI in Healthcare", date: "2026-03-25", venue: "Science Block", status: "Confirmed" }
];

let mockAttendees = [
  { eventId: 101, name: "Alice Smith", email: "alice@college.edu", role: "Attendee", regDate: "2026-02-10", code: "TICK-8821" },
  { eventId: 101, name: "Bob Jones", email: "bob@college.edu", role: "Attendee", regDate: "2026-02-12", code: "TICK-9902" },
  { eventId: 102, name: "Charlie Brown", email: "charlie@college.edu", role: "Attendee", regDate: "2026-02-14", code: "TICK-1123" },
  { eventId: 103, name: "Alice Smith", email: "alice@college.edu", role: "Attendee", regDate: "2026-02-15", code: "TICK-4309" }
];

// Current State
let currentUser = { name: "Admin User", role: "Administrator", initials: "AD" };

// DOM Elements
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menu-toggle');
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('.app-section');
const pageTitle = document.getElementById('page-title');
const roleToggleBtn = document.getElementById('role-toggle-btn');
const adminOnlyElements = document.querySelectorAll('.admin-only');

// Modal Elements
const eventModal = document.getElementById('event-modal');
const openCreateModalBtn = document.getElementById('open-create-modal');
const closeEventModalBtn = document.getElementById('close-event-modal');
const cancelEventModalBtn = document.getElementById('cancel-event-modal');
const eventForm = document.getElementById('event-form');

const authModal = document.getElementById('auth-modal');
const closeAuthModalBtn = document.getElementById('close-auth-modal');
const logoutBtn = document.getElementById('logout-btn');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

// Filter Elements
const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const venueFilter = document.getElementById('venue-filter');
const dateFilter = document.getElementById('date-filter');
const resetFiltersBtn = document.getElementById('reset-filters-btn');

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupRoleToggle();
  setupModals();
  setupFilters();
  renderAllViews();
});

function setupNavigation() {
  menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('data-target');
      switchSection(targetId);
      if (window.innerWidth <= 768) sidebar.classList.remove('open');
    });
  });
}

function switchSection(targetSectionId) {
  navLinks.forEach(l => l.classList.remove('active'));
  sections.forEach(s => s.classList.remove('active'));

  const activeLink = document.querySelector(`.nav-link[data-target="${targetSectionId}"]`);
  const activeSection = document.getElementById(targetSectionId);

  if (activeLink) activeLink.classList.add('active');
  if (activeSection) activeSection.classList.add('active');

  const titleText = activeLink ? activeLink.querySelector('.label').textContent : 'Dashboard';
  pageTitle.textContent = titleText;
}

function setupRoleToggle() {
  roleToggleBtn.addEventListener('click', () => {
    if (currentUser.role === "Administrator") {
      currentUser = { name: "Alex Johnson", role: "Attendee", initials: "AJ" };
      roleToggleBtn.textContent = "🔄 Switch to Admin View";
    } else {
      currentUser = { name: "Admin User", role: "Administrator", initials: "AD" };
      roleToggleBtn.textContent = "🔄 Switch to Attendee View";
    }
    updateUserInterfaceRole();
  });
}

function updateUserInterfaceRole() {
  document.getElementById('user-display-name').textContent = currentUser.name;
  document.getElementById('user-display-role').textContent = currentUser.role;
  document.getElementById('user-avatar-initials').textContent = currentUser.initials;

  const isAdmin = currentUser.role === "Administrator";
  adminOnlyElements.forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });

  if (!isAdmin) {
    const currentActive = document.querySelector('.app-section.active').id;
    if (currentActive === 'attendees-section' || currentActive === 'reports-section') {
      switchSection('dashboard-section');
    }
  }
}

function renderAllViews() {
  renderDashboardTable();
  renderCatalogCards();
  renderUserBookings();
  renderAttendeeSelectOptions();
  renderAttendeeRoster();
  renderReportsTable();
  updateStatCards();
}

function updateStatCards() {
  document.getElementById('stat-total-events').textContent = mockEvents.length;
  const totalBookings = mockEvents.reduce((acc, curr) => acc + curr.registered, 0);
  document.getElementById('stat-total-bookings').textContent = totalBookings;
}

function renderDashboardTable() {
  const tbody = document.getElementById('dashboard-events-tbody');
  tbody.innerHTML = '';

  mockEvents.slice(0, 5).forEach(evt => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${evt.title}</strong></td>
      <td><span class="badge" style="background:#eef2ff; color:#4f46e5;">${evt.category}</span></td>
      <td>📅 ${evt.date} at ${evt.time}</td>
      <td>📍 ${evt.venue}</td>
      <td>💺 ${evt.registered}/${evt.capacity}</td>
      <td>
        ${currentUser.role === "Administrator" ? `
          <button class="btn-text" onclick="editEvent(${evt.id})">✏️ Edit</button> | 
          <button class="btn-text" style="color:var(--danger);" onclick="deleteEvent(${evt.id})">🗑️ Delete</button>
        ` : `
          <button class="btn-text" onclick="bookSeat(${evt.id})">🎟️ Book</button>
        `}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderCatalogCards() {
  const grid = document.getElementById('events-card-grid');
  grid.innerHTML = '';

  const search = searchInput.value.toLowerCase();
  const category = categoryFilter.value;
  const venue = venueFilter.value;
  const date = dateFilter.value;

  const filtered = mockEvents.filter(evt => {
    const matchesSearch = evt.title.toLowerCase().includes(search);
    const matchesCategory = (category === 'All' || evt.category === category);
    const matchesVenue = (venue === 'All' || evt.venue === venue);
    const matchesDate = (!date || evt.date === date);
    return matchesSearch && matchesCategory && matchesVenue && matchesDate;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">⚠️ No events matching search criteria found.</p>`;
    return;
  }

  filtered.forEach(evt => {
    const isFull = evt.registered >= evt.capacity;
    const bannerUrl = categoryBanners[evt.category] || categoryBanners.Technology;
    const card = document.createElement('div');
    card.className = 'card event-card';
    card.innerHTML = `
      <div class="event-card-banner" style="background-image: url('${bannerUrl}');"></div>
      <div>
        <span class="event-category-tag">🏷️ ${evt.category}</span>
        <h4 class="event-title">${evt.title}</h4>
        <ul class="event-details-list">
          <li>📅 ${evt.date} at ${evt.time}</li>
          <li>📍 ${evt.venue}</li>
          <li>🎟️ Seats: ${evt.registered}/${evt.capacity} ${isFull ? '<strong style="color:var(--danger);">(Full)</strong>' : ''}</li>
        </ul>
      </div>
      <div class="event-card-footer">
        <button class="btn ${isFull ? 'btn-secondary' : 'btn-primary'} btn-block" 
          ${isFull ? 'disabled' : ''} 
          onclick="bookSeat(${evt.id})">
          ${isFull ? '🚫 Fully Booked' : '🎟️ Register / Book Seat'}
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function renderUserBookings() {
  const tbody = document.getElementById('user-bookings-tbody');
  tbody.innerHTML = '';

  if (mockBookings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No event tickets booked yet.</td></tr>`;
    return;
  }

  mockBookings.forEach(b => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${b.ticketCode}</code></td>
      <td><strong>${b.eventTitle}</strong></td>
      <td>📅 ${b.date}</td>
      <td>📍 ${b.venue}</td>
      <td><span class="badge badge-success">✓ ${b.status}</span></td>
      <td><button class="btn-text" style="color:var(--danger);" onclick="cancelBooking('${b.ticketCode}')">Cancel</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderAttendeeSelectOptions() {
  const select = document.getElementById('attendee-event-select');
  select.innerHTML = '';
  mockEvents.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = `${e.title} (${e.date})`;
    select.appendChild(opt);
  });
  select.addEventListener('change', renderAttendeeRoster);
}

function renderAttendeeRoster() {
  const select = document.getElementById('attendee-event-select');
  const tbody = document.getElementById('attendee-roster-tbody');
  const title = document.getElementById('selected-event-roster-title');
  if (!select.value) return;

  const eventId = parseInt(select.value);
  const event = mockEvents.find(e => e.id === eventId);
  if (event) title.textContent = `📋 Attendee Roster: ${event.title}`;

  tbody.innerHTML = '';
  const attendees = mockAttendees.filter(a => a.eventId === eventId);

  if (attendees.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No registered attendees for this event yet.</td></tr>`;
    return;
  }

  attendees.forEach(a => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${a.code}</code></td>
      <td><strong>${a.name}</strong></td>
      <td>${a.email}</td>
      <td><span class="badge" style="background:#e2e8f0;">${a.role}</span></td>
      <td>${a.regDate}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderReportsTable() {
  const tbody = document.getElementById('reports-tbody');
  tbody.innerHTML = '';

  mockEvents.forEach(evt => {
    const rate = ((evt.registered / evt.capacity) * 100).toFixed(1);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>EVT-${evt.id}</code></td>
      <td><strong>${evt.title}</strong></td>
      <td>${evt.category}</td>
      <td>${evt.capacity}</td>
      <td>${evt.registered}</td>
      <td>
        <span class="badge ${rate >= 100 ? 'badge-warning' : 'badge-success'}">${rate}%</span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function setupFilters() {
  [searchInput, categoryFilter, venueFilter, dateFilter].forEach(el => {
    el.addEventListener('input', renderCatalogCards);
  });

  resetFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    categoryFilter.value = 'All';
    venueFilter.value = 'All';
    dateFilter.value = '';
    renderCatalogCards();
  });
}

function setupModals() {
  openCreateModalBtn.addEventListener('click', () => {
    document.getElementById('event-form').reset();
    document.getElementById('event-id').value = '';
    document.getElementById('modal-event-title').textContent = "✨ Create New Event";
    eventModal.classList.add('active');
  });

  [closeEventModalBtn, cancelEventModalBtn].forEach(btn => {
    btn.addEventListener('click', () => eventModal.classList.remove('active'));
  });

  eventForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('event-id').value;
    const newEvent = {
      id: id ? parseInt(id) : Date.now(),
      title: document.getElementById('form-title').value,
      category: document.getElementById('form-category').value,
      date: document.getElementById('form-date').value,
      time: document.getElementById('form-time').value,
      venue: document.getElementById('form-venue').value,
      capacity: parseInt(document.getElementById('form-capacity').value),
      registered: id ? mockEvents.find(e => e.id == id).registered : 0
    };

    if (id) {
      const idx = mockEvents.findIndex(e => e.id == id);
      mockEvents[idx] = newEvent;
    } else {
      mockEvents.unshift(newEvent);
    }

    eventModal.classList.remove('active');
    renderAllViews();
    alert(`Event successfully ${id ? 'updated' : 'created'}! 🎉`);
  });

  logoutBtn.addEventListener('click', () => authModal.classList.add('active'));
  closeAuthModalBtn.addEventListener('click', () => authModal.classList.remove('active'));

  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active'); tabRegister.classList.remove('active');
    loginForm.classList.add('active'); registerForm.classList.remove('active');
  });

  tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active'); tabLogin.classList.remove('active');
    registerForm.classList.add('active'); loginForm.classList.remove('active');
  });

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    authModal.classList.remove('active');
    alert("Logged in successfully (Mock Authentication). 🚀");
  });

  registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    authModal.classList.remove('active');
    alert("Account registered successfully (Mock Authentication). 🎉");
  });
}

window.bookSeat = function(eventId) {
  const event = mockEvents.find(e => e.id === eventId);
  if (!event) return;

  if (event.registered >= event.capacity) {
    alert("Sorry, this event is fully booked!");
    return;
  }

  const code = "TICK-" + Math.floor(1000 + Math.random() * 9000);
  event.registered += 1;

  mockBookings.push({
    ticketCode: code,
    eventId: event.id,
    eventTitle: event.title,
    date: event.date,
    venue: event.venue,
    status: "Confirmed"
  });

  mockAttendees.push({
    eventId: event.id,
    name: currentUser.name,
    email: currentUser.name.toLowerCase().replace(" ", "") + "@college.edu",
    role: currentUser.role,
    regDate: new Date().toISOString().split('T')[0],
    code: code
  });

  renderAllViews();
  alert(`Booking Confirmed! 🎉\nYour Unique Registration Ticket Code is: ${code}`);
};

window.cancelBooking = function(ticketCode) {
  if (!confirm("Are you sure you want to cancel this registration?")) return;

  const bIdx = mockBookings.findIndex(b => b.ticketCode === ticketCode);
  if (bIdx !== -1) {
    const eventId = mockBookings[bIdx].eventId;
    const event = mockEvents.find(e => e.id === eventId);
    if (event && event.registered > 0) event.registered -= 1;

    mockBookings.splice(bIdx, 1);
    renderAllViews();
  }
};

window.editEvent = function(eventId) {
  const event = mockEvents.find(e => e.id === eventId);
  if (!event) return;

  document.getElementById('event-id').value = event.id;
  document.getElementById('form-title').value = event.title;
  document.getElementById('form-category').value = event.category;
  document.getElementById('form-date').value = event.date;
  document.getElementById('form-time').value = event.time;
  document.getElementById('form-venue').value = event.venue;
  document.getElementById('form-capacity').value = event.capacity;

  document.getElementById('modal-event-title').textContent = "✏️ Edit Event";
  eventModal.classList.add('active');
};

window.deleteEvent = function(eventId) {
  if (!confirm("Are you sure you want to delete this event?")) return;

  mockEvents = mockEvents.filter(e => e.id !== eventId);
  renderAllViews();
};

document.getElementById('export-attendees-btn').addEventListener('click', () => {
  alert("Simulated Action: Attendees CSV report generated and downloaded. 📥");
});

document.getElementById('export-report-btn').addEventListener('click', () => {
  alert("Simulated Action: Event Capacity Summary CSV report generated and downloaded. 📥");
});