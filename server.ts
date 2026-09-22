import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;
const SECRET_KEY = process.env.JWT_SECRET || "campus-ems-college-demo-secret-change-in-production";

app.use(cors());
app.use(express.json());

// --- Types ---
interface User {
  id: number;
  full_name: string;
  username: string;
  email: string;
  salt: string;
  password_hash: string;
  role: "admin" | "organizer" | "attendee";
  created_at: string;
}

interface EventItem {
  id: number;
  title: string;
  category: "Technology" | "Academic" | "Cultural" | "Sports";
  date: string;
  time: string;
  venue: string;
  capacity: number;
  status: "active" | "cancelled";
  organizer_id: number;
  created_at: string;
}

interface Registration {
  id: number;
  event_id: number;
  user_id: number;
  confirmation_code: string;
  created_at: string;
}

interface LoginAttempt {
  id: number;
  username: string;
  success: "success" | "failed";
  created_at: string;
}

// --- Helpers ---
function generateSalt(): string {
  return crypto.randomBytes(8).toString("hex");
}

function hashPassword(password: string, salt: string): string {
  return crypto.createHash("sha256").update(salt + password).digest("hex");
}

function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  return hashPassword(password, salt) === storedHash;
}

function eventIsUpcoming(dateStr: string, timeStr: string): boolean {
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    const [hours, minutes] = timeStr.split(":").map(Number);
    const eventDt = new Date(year, month - 1, day, hours || 0, minutes || 0);
    return eventDt.getTime() >= Date.now();
  } catch {
    return false;
  }
}

function formatDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// --- In-Memory Store & Seed Data ---
let nextUserId = 1;
let nextEventId = 1;
let nextRegId = 1;
let nextLoginId = 1;

const users: User[] = [];
const events: EventItem[] = [];
const registrations: Registration[] = [];
const loginAttempts: LoginAttempt[] = [];

function seedDatabase() {
  const adminSalt = generateSalt();
  const orgSalt = generateSalt();
  const attSalt = generateSalt();
  const studentSalt = generateSalt();

  const adminId = nextUserId++;
  users.push({
    id: adminId,
    full_name: "Campus Admin",
    username: "admin",
    email: "admin@campus.edu",
    salt: adminSalt,
    password_hash: hashPassword("Admin@123", adminSalt),
    role: "admin",
    created_at: new Date().toISOString(),
  });

  const orgId = nextUserId++;
  users.push({
    id: orgId,
    full_name: "Priya Organizer",
    username: "organizer",
    email: "organizer@campus.edu",
    salt: orgSalt,
    password_hash: hashPassword("Organizer@123", orgSalt),
    role: "organizer",
    created_at: new Date().toISOString(),
  });

  const attId = nextUserId++;
  users.push({
    id: attId,
    full_name: "Alex Student",
    username: "attendee",
    email: "alex@campus.edu",
    salt: attSalt,
    password_hash: hashPassword("Attendee@123", attSalt),
    role: "attendee",
    created_at: new Date().toISOString(),
  });

  const saraId = nextUserId++;
  users.push({
    id: saraId,
    full_name: "Sara Patel",
    username: "sara",
    email: "sara@campus.edu",
    salt: studentSalt,
    password_hash: hashPassword("Student@123", studentSalt),
    role: "attendee",
    created_at: new Date().toISOString(),
  });

  const sampleEvents: Omit<EventItem, "id" | "created_at">[] = [
    {
      title: "Annual Tech Symposium",
      category: "Technology",
      date: formatDateOffset(20),
      time: "10:00",
      venue: "Main Auditorium",
      capacity: 150,
      status: "active",
      organizer_id: orgId,
    },
    {
      title: "Inter-College Chess Championship",
      category: "Sports",
      date: formatDateOffset(25),
      time: "09:00",
      venue: "Hall B",
      capacity: 50,
      status: "active",
      organizer_id: orgId,
    },
    {
      title: "Guest Lecture: AI in Healthcare",
      category: "Academic",
      date: formatDateOffset(30),
      time: "14:00",
      venue: "Science Block",
      capacity: 80,
      status: "active",
      organizer_id: orgId,
    },
    {
      title: "Spring Cultural Festival",
      category: "Cultural",
      date: formatDateOffset(40),
      time: "17:00",
      venue: "Campus Ground",
      capacity: 300,
      status: "active",
      organizer_id: orgId,
    },
    {
      title: "Freshers Orientation Recap",
      category: "Academic",
      date: formatDateOffset(-10),
      time: "11:00",
      venue: "Main Auditorium",
      capacity: 200,
      status: "active",
      organizer_id: adminId,
    },
  ];

  for (const item of sampleEvents) {
    events.push({
      ...item,
      id: nextEventId++,
      created_at: new Date().toISOString(),
    });
  }

  registrations.push(
    {
      id: nextRegId++,
      event_id: events[0].id,
      user_id: attId,
      confirmation_code: "EMS-A1B2C3D4",
      created_at: new Date().toISOString(),
    },
    {
      id: nextRegId++,
      event_id: events[2].id,
      user_id: attId,
      confirmation_code: "EMS-E5F6G7H8",
      created_at: new Date().toISOString(),
    }
  );

  loginAttempts.push({
    id: nextLoginId++,
    username: "unknown",
    success: "failed",
    created_at: new Date(Date.now() - 86400000).toISOString(),
  });
}

seedDatabase();

function userOut(u: User) {
  return {
    id: u.id,
    full_name: u.full_name,
    username: u.username,
    email: u.email,
    role: u.role,
    created_at: u.created_at,
  };
}

function toEventOut(ev: EventItem) {
  const registered = registrations.filter((r) => r.event_id === ev.id).length;
  const isUpcoming = eventIsUpcoming(ev.date, ev.time) && ev.status === "active";
  return {
    id: ev.id,
    title: ev.title,
    category: ev.category,
    date: ev.date,
    time: ev.time,
    venue: ev.venue,
    capacity: ev.capacity,
    status: ev.status,
    organizer_id: ev.organizer_id,
    registered,
    is_upcoming: isUpcoming,
  };
}

// --- Auth Middleware ---
interface AuthRequest extends Request {
  user?: User;
}

function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ detail: "Not authenticated" });
  }

  try {
    const payload = jwt.verify(token, SECRET_KEY) as { sub: string; role: string };
    const user = users.find((u) => u.username.toLowerCase() === payload.sub.toLowerCase());
    if (!user) {
      return res.status(401).json({ detail: "User not found" });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ detail: "Invalid or expired token" });
  }
}

function requireRoles(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ detail: "Not authorized for this action" });
    }
    next();
  };
}

// ==========================================
// API ROUTES
// ==========================================

// Health
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Auth: Register
app.post("/api/auth/register", (req, res) => {
  const { full_name, username, email, password, role } = req.body || {};

  if (!full_name || full_name.trim().length < 2) {
    return res.status(400).json({ detail: "Full name must be at least 2 characters" });
  }
  const cleanUsername = String(username || "").trim().toLowerCase();
  if (!cleanUsername || cleanUsername.length < 3 || cleanUsername.length > 50) {
    return res.status(400).json({ detail: "Username must be between 3 and 50 characters" });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
    return res.status(400).json({ detail: "Username may contain letters, numbers, and underscores only" });
  }
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return res.status(400).json({ detail: "Invalid email address" });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ detail: "Password must be at least 8 characters" });
  }
  const validRole = role === "organizer" ? "organizer" : "attendee";

  if (users.some((u) => u.username.toLowerCase() === cleanUsername)) {
    return res.status(400).json({ detail: "Username already exists" });
  }
  if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
    return res.status(400).json({ detail: "Email already exists" });
  }

  const salt = generateSalt();
  const newUser: User = {
    id: nextUserId++,
    full_name: full_name.trim(),
    username: cleanUsername,
    email: cleanEmail,
    salt,
    password_hash: hashPassword(password, salt),
    role: validRole,
    created_at: new Date().toISOString(),
  };

  users.push(newUser);
  return res.status(201).json(userOut(newUser));
});

// Auth: Login
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  const identifier = String(username || "").trim().toLowerCase();

  const user = users.find(
    (u) => u.username.toLowerCase() === identifier || u.email.toLowerCase() === identifier
  );

  const attemptId = nextLoginId++;
  if (!user || !verifyPassword(password, user.salt, user.password_hash)) {
    loginAttempts.push({
      id: attemptId,
      username: identifier,
      success: "failed",
      created_at: new Date().toISOString(),
    });
    return res.status(401).json({ detail: "Invalid username or password" });
  }

  loginAttempts.push({
    id: attemptId,
    username: user.username,
    success: "success",
    created_at: new Date().toISOString(),
  });

  const token = jwt.sign(
    { sub: user.username, role: user.role },
    SECRET_KEY,
    { expiresIn: "8h" }
  );

  res.json({
    access_token: token,
    token_type: "bearer",
    user: userOut(user),
  });
});

// Auth: Me
app.get("/api/auth/me", authenticateToken, (req: AuthRequest, res) => {
  res.json(userOut(req.user!));
});

// Users (Admin only)
app.get("/api/users", authenticateToken, requireRoles("admin"), (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  let list = [...users];

  if (q) {
    list = list.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }

  list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  res.json(list.map(userOut));
});

app.post("/api/users", authenticateToken, requireRoles("admin"), (req, res) => {
  const { full_name, username, email, password, role } = req.body || {};

  if (!full_name || full_name.trim().length < 2) {
    return res.status(400).json({ detail: "Full name must be at least 2 characters" });
  }
  const cleanUsername = String(username || "").trim().toLowerCase();
  if (!cleanUsername || cleanUsername.length < 3) {
    return res.status(400).json({ detail: "Username must be at least 3 characters" });
  }
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return res.status(400).json({ detail: "Invalid email" });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ detail: "Password must be at least 8 characters" });
  }
  if (users.some((u) => u.username.toLowerCase() === cleanUsername)) {
    return res.status(400).json({ detail: "Username already exists" });
  }
  if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
    return res.status(400).json({ detail: "Email already exists" });
  }

  const validRole = ["admin", "organizer", "attendee"].includes(role) ? role : "attendee";
  const salt = generateSalt();
  const newUser: User = {
    id: nextUserId++,
    full_name: full_name.trim(),
    username: cleanUsername,
    email: cleanEmail,
    salt,
    password_hash: hashPassword(password, salt),
    role: validRole,
    created_at: new Date().toISOString(),
  };

  users.push(newUser);
  res.status(201).json(userOut(newUser));
});

app.put("/api/users/:id", authenticateToken, requireRoles("admin"), (req: AuthRequest, res) => {
  const targetId = Number(req.params.id);
  const user = users.find((u) => u.id === targetId);
  if (!user) {
    return res.status(404).json({ detail: "User not found" });
  }

  const { full_name, email, role, password } = req.body || {};

  if (email) {
    const newEmail = String(email).trim().toLowerCase();
    if (users.some((u) => u.id !== targetId && u.email.toLowerCase() === newEmail)) {
      return res.status(400).json({ detail: "Email already exists" });
    }
    user.email = newEmail;
  }
  if (full_name) {
    user.full_name = full_name.trim();
  }
  if (role) {
    if (targetId === req.user!.id && role !== "admin") {
      return res.status(400).json({ detail: "You cannot remove your own admin role" });
    }
    if (["admin", "organizer", "attendee"].includes(role)) {
      user.role = role;
    }
  }
  if (password && password.length >= 8) {
    const salt = generateSalt();
    user.salt = salt;
    user.password_hash = hashPassword(password, salt);
  }

  res.json(userOut(user));
});

app.delete("/api/users/:id", authenticateToken, requireRoles("admin"), (req: AuthRequest, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user!.id) {
    return res.status(400).json({ detail: "You cannot delete your own account" });
  }

  const userIdx = users.findIndex((u) => u.id === targetId);
  if (userIdx === -1) {
    return res.status(404).json({ detail: "User not found" });
  }

  // Delete user's registrations
  for (let i = registrations.length - 1; i >= 0; i--) {
    if (registrations[i].user_id === targetId) {
      registrations.splice(i, 1);
    }
  }

  // Delete events organized by this user and their registrations
  const userEvents = events.filter((e) => e.organizer_id === targetId);
  for (const ev of userEvents) {
    for (let i = registrations.length - 1; i >= 0; i--) {
      if (registrations[i].event_id === ev.id) {
        registrations.splice(i, 1);
      }
    }
    const evIdx = events.findIndex((e) => e.id === ev.id);
    if (evIdx !== -1) events.splice(evIdx, 1);
  }

  users.splice(userIdx, 1);
  res.status(204).send();
});

// Events
app.get("/api/events", authenticateToken, (req, res) => {
  const { search, category, venue, date, timeframe } = req.query as { [key: string]: string };

  let list = events.map(toEventOut);

  if (search) {
    const s = search.trim().toLowerCase();
    list = list.filter(
      (e) =>
        e.title.toLowerCase().includes(s) ||
        e.venue.toLowerCase().includes(s) ||
        e.category.toLowerCase().includes(s)
    );
  }

  if (category && category !== "All") {
    list = list.filter((e) => e.category === category);
  }

  if (venue && venue !== "All") {
    list = list.filter((e) => e.venue === venue);
  }

  if (date) {
    list = list.filter((e) => e.date === date);
  }

  list.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });

  if (timeframe === "upcoming") {
    list = list.filter((e) => e.is_upcoming);
  } else if (timeframe === "past") {
    list = list.filter((e) => !e.is_upcoming);
  }

  res.json(list);
});

app.post("/api/events", authenticateToken, requireRoles("admin", "organizer"), (req: AuthRequest, res) => {
  const { title, category, date, time, venue, capacity } = req.body || {};

  if (!title || title.trim().length < 3) {
    return res.status(400).json({ detail: "Title must be at least 3 characters" });
  }
  if (!venue || venue.trim().length < 2) {
    return res.status(400).json({ detail: "Venue must be at least 2 characters" });
  }
  const cap = Number(capacity);
  if (!cap || cap < 1 || cap > 5000) {
    return res.status(400).json({ detail: "Capacity must be between 1 and 5000" });
  }

  const newEvent: EventItem = {
    id: nextEventId++,
    title: title.trim(),
    category: category || "Technology",
    date: date || formatDateOffset(7),
    time: time || "10:00",
    venue: venue.trim(),
    capacity: cap,
    status: "active",
    organizer_id: req.user!.id,
    created_at: new Date().toISOString(),
  };

  events.push(newEvent);
  res.status(201).json(toEventOut(newEvent));
});

app.put("/api/events/:id", authenticateToken, requireRoles("admin", "organizer"), (req: AuthRequest, res) => {
  const eventId = Number(req.params.id);
  const ev = events.find((e) => e.id === eventId);
  if (!ev) {
    return res.status(404).json({ detail: "Event not found" });
  }

  const canManage = req.user!.role === "admin" || ev.organizer_id === req.user!.id;
  if (!canManage) {
    return res.status(403).json({ detail: "You can only manage your own events" });
  }

  const { title, category, date, time, venue, capacity, status } = req.body || {};

  if (capacity !== undefined) {
    const cap = Number(capacity);
    const regCount = registrations.filter((r) => r.event_id === eventId).length;
    if (cap < regCount) {
      return res.status(400).json({ detail: "Capacity cannot be below current registrations" });
    }
    ev.capacity = cap;
  }

  if (title) ev.title = title.trim();
  if (category) ev.category = category;
  if (date) ev.date = date;
  if (time) ev.time = time;
  if (venue) ev.venue = venue.trim();
  if (status && (status === "active" || status === "cancelled")) ev.status = status;

  res.json(toEventOut(ev));
});

app.delete("/api/events/:id", authenticateToken, requireRoles("admin", "organizer"), (req: AuthRequest, res) => {
  const eventId = Number(req.params.id);
  const ev = events.find((e) => e.id === eventId);
  if (!ev) {
    return res.status(404).json({ detail: "Event not found" });
  }

  const canManage = req.user!.role === "admin" || ev.organizer_id === req.user!.id;
  if (!canManage) {
    return res.status(403).json({ detail: "You can only delete your own events" });
  }

  for (let i = registrations.length - 1; i >= 0; i--) {
    if (registrations[i].event_id === eventId) {
      registrations.splice(i, 1);
    }
  }

  const idx = events.findIndex((e) => e.id === eventId);
  if (idx !== -1) events.splice(idx, 1);

  res.status(204).send();
});

// Registrations / Bookings
app.post("/api/events/:id/register", authenticateToken, (req: AuthRequest, res) => {
  const eventId = Number(req.params.id);
  const ev = events.find((e) => e.id === eventId);
  if (!ev) {
    return res.status(404).json({ detail: "Event not found" });
  }
  if (ev.status !== "active") {
    return res.status(400).json({ detail: "This event has been cancelled" });
  }
  if (!eventIsUpcoming(ev.date, ev.time)) {
    return res.status(400).json({ detail: "Cannot register for a past event" });
  }

  const regCount = registrations.filter((r) => r.event_id === eventId).length;
  if (regCount >= ev.capacity) {
    return res.status(400).json({ detail: "This event is fully booked" });
  }

  const existing = registrations.find(
    (r) => r.event_id === eventId && r.user_id === req.user!.id
  );
  if (existing) {
    return res.status(400).json({ detail: "You are already registered for this event" });
  }

  const code = "EMS-" + crypto.randomBytes(4).toString("hex").toUpperCase();
  const reg: Registration = {
    id: nextRegId++,
    event_id: eventId,
    user_id: req.user!.id,
    confirmation_code: code,
    created_at: new Date().toISOString(),
  };
  registrations.push(reg);

  res.status(201).json({
    id: reg.id,
    confirmation_code: reg.confirmation_code,
    event_id: ev.id,
    event_title: ev.title,
    date: ev.date,
    time: ev.time,
    venue: ev.venue,
    status: ev.status === "cancelled" ? "Cancelled" : "Confirmed",
    created_at: reg.created_at,
  });
});

app.get("/api/bookings", authenticateToken, (req: AuthRequest, res) => {
  const userRegs = registrations
    .filter((r) => r.user_id === req.user!.id)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const list = userRegs.map((r) => {
    const ev = events.find((e) => e.id === r.event_id);
    return {
      id: r.id,
      confirmation_code: r.confirmation_code,
      event_id: r.event_id,
      event_title: ev ? ev.title : "Unknown Event",
      date: ev ? ev.date : "",
      time: ev ? ev.time : "",
      venue: ev ? ev.venue : "",
      status: ev && ev.status === "cancelled" ? "Cancelled" : "Confirmed",
      created_at: r.created_at,
    };
  });

  res.json(list);
});

app.delete("/api/bookings/:id", authenticateToken, (req: AuthRequest, res) => {
  const regId = Number(req.params.id);
  const reg = registrations.find((r) => r.id === regId);
  if (!reg) {
    return res.status(404).json({ detail: "Booking not found" });
  }

  const ev = events.find((e) => e.id === reg.event_id);
  const ownsEvent =
    (req.user!.role === "admin" || req.user!.role === "organizer") &&
    (req.user!.role === "admin" || (ev && ev.organizer_id === req.user!.id));

  if (reg.user_id !== req.user!.id && !ownsEvent) {
    return res.status(403).json({ detail: "You can only cancel your own booking" });
  }

  const idx = registrations.findIndex((r) => r.id === regId);
  if (idx !== -1) registrations.splice(idx, 1);

  res.status(204).send();
});

// Attendees Roster
app.get("/api/events/:id/attendees", authenticateToken, requireRoles("admin", "organizer"), (req: AuthRequest, res) => {
  const eventId = Number(req.params.id);
  const ev = events.find((e) => e.id === eventId);
  if (!ev) {
    return res.status(404).json({ detail: "Event not found" });
  }

  if (req.user!.role !== "admin" && ev.organizer_id !== req.user!.id) {
    return res.status(403).json({ detail: "Not allowed to view this roster" });
  }

  const eventRegs = registrations.filter((r) => r.event_id === eventId);
  const results = eventRegs.map((reg) => {
    const u = users.find((item) => item.id === reg.user_id);
    return {
      registration_id: reg.id,
      confirmation_code: reg.confirmation_code,
      user_id: reg.user_id,
      full_name: u ? u.full_name : "Unknown",
      email: u ? u.email : "",
      role: u ? u.role : "attendee",
      registration_date: reg.created_at,
    };
  });

  res.json(results);
});

app.get("/api/events/:id/attendees/export", authenticateToken, requireRoles("admin", "organizer"), (req: AuthRequest, res) => {
  const eventId = Number(req.params.id);
  const ev = events.find((e) => e.id === eventId);
  if (!ev) {
    return res.status(404).json({ detail: "Event not found" });
  }

  if (req.user!.role !== "admin" && ev.organizer_id !== req.user!.id) {
    return res.status(403).json({ detail: "Not allowed to export this roster" });
  }

  const eventRegs = registrations.filter((r) => r.event_id === eventId);
  const header = "confirmation_code,full_name,email,role,registration_date\n";
  const rows = eventRegs
    .map((reg) => {
      const u = users.find((item) => item.id === reg.user_id);
      const name = u ? `"${u.full_name.replace(/"/g, '""')}"` : '""';
      const email = u ? `"${u.email.replace(/"/g, '""')}"` : '""';
      const role = u ? u.role : "attendee";
      return `${reg.confirmation_code},${name},${email},${role},${reg.created_at.slice(0, 19)}`;
    })
    .join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="attendees-event-${eventId}.csv"`);
  res.send(header + rows);
});

// Dashboard & Reports
app.get("/api/dashboard/stats", authenticateToken, (_req, res) => {
  const totalBookings = registrations.length;
  const totalUsers = users.length;
  const venues = new Set(events.map((e) => e.venue).filter(Boolean));

  const occupancies: number[] = [];
  let popularTitle: string | null = null;
  let maxRegs = -1;

  for (const e of events) {
    const regCount = registrations.filter((r) => r.event_id === e.id).length;
    if (e.capacity > 0) {
      occupancies.push(Math.round((regCount / e.capacity) * 1000) / 10);
    }
    if (regCount > maxRegs) {
      maxRegs = regCount;
      popularTitle = e.title;
    }
  }

  const avgOccupancy =
    occupancies.length > 0
      ? Math.round((occupancies.reduce((a, b) => a + b, 0) / occupancies.length) * 10) / 10
      : 0;

  res.json({
    total_events: events.length,
    total_bookings: totalBookings,
    registered_users: totalUsers,
    active_venues: venues.size,
    avg_occupancy: avgOccupancy,
    most_popular_event: maxRegs > 0 ? popularTitle : null,
  });
});

app.get("/api/dashboard/activity", authenticateToken, (_req, res) => {
  interface ActivityItem {
    kind: string;
    message: string;
    created_at: string;
  }

  const items: ActivityItem[] = [];

  const recentRegs = [...registrations]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 8);

  for (const reg of recentRegs) {
    const u = users.find((item) => item.id === reg.user_id);
    const ev = events.find((item) => item.id === reg.event_id);
    items.push({
      kind: "RSVP",
      message: `${u ? u.full_name : "A user"} registered for ${ev ? ev.title : "an event"}`,
      created_at: reg.created_at,
    });
  }

  const recentEvents = [...events]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 4);

  for (const ev of recentEvents) {
    const u = users.find((item) => item.id === ev.organizer_id);
    items.push({
      kind: "Event",
      message: `${u ? u.full_name : "An organizer"} created ${ev.title}`,
      created_at: ev.created_at,
    });
  }

  items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  res.json(items.slice(0, 8));
});

app.get("/api/reports/events", authenticateToken, requireRoles("admin", "organizer"), (_req, res) => {
  const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date));

  const list = sorted.map((ev) => {
    const regCount = registrations.filter((r) => r.event_id === ev.id).length;
    const occ = ev.capacity > 0 ? Math.round((regCount / ev.capacity) * 1000) / 10 : 0;
    return {
      event_id: ev.id,
      title: ev.title,
      category: ev.category,
      venue: ev.venue,
      date: ev.date,
      capacity: ev.capacity,
      registered: regCount,
      occupancy_rate: occ,
      status: ev.status,
    };
  });

  res.json(list);
});

app.get("/api/reports/events/export", authenticateToken, requireRoles("admin", "organizer"), (_req, res) => {
  const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date));
  const header = "event_id,title,category,venue,date,capacity,registered,occupancy_rate,status\n";
  const rows = sorted
    .map((ev) => {
      const regCount = registrations.filter((r) => r.event_id === ev.id).length;
      const occ = ev.capacity > 0 ? Math.round((regCount / ev.capacity) * 1000) / 10 : 0;
      const title = `"${ev.title.replace(/"/g, '""')}"`;
      const category = `"${ev.category.replace(/"/g, '""')}"`;
      const venue = `"${ev.venue.replace(/"/g, '""')}"`;
      return `${ev.id},${title},category=${category},${venue},${ev.date},${ev.capacity},${regCount},${occ},${ev.status}`;
    })
    .join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="event-reports.csv"');
  res.send(header + rows);
});

// ==========================================
// AI ASSISTANT & RECOMMENDATIONS API
// ==========================================
app.post("/api/ai/assistant", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { prompt, mode } = req.body || {};
    const queryPrompt = typeof prompt === "string" ? prompt.trim() : "";
    const requestedMode = typeof mode === "string" ? mode : "general";

    // Gather real-time management data
    const totalEvents = events.length;
    const totalRegistrations = registrations.length;
    const totalUsers = users.length;
    const activeVenues = Array.from(new Set(events.map((e) => e.venue).filter(Boolean)));

    const eventSummaries = events.map((ev) => {
      const regCount = registrations.filter((r) => r.event_id === ev.id).length;
      const occ = ev.capacity > 0 ? Math.round((regCount / ev.capacity) * 1000) / 10 : 0;
      const isUpcoming = eventIsUpcoming(ev.date, ev.time) && ev.status === "active";
      return {
        id: ev.id,
        title: ev.title,
        category: ev.category,
        date: ev.date,
        time: ev.time,
        venue: ev.venue,
        capacity: ev.capacity,
        registered: regCount,
        occupancy_rate: `${occ}%`,
        status: ev.status,
        is_upcoming: isUpcoming,
      };
    });

    const userBookings = registrations
      .filter((r) => r.user_id === user.id)
      .map((r) => {
        const ev = events.find((e) => e.id === r.event_id);
        return {
          event_id: r.event_id,
          title: ev ? ev.title : "Unknown",
          category: ev ? ev.category : "General",
        };
      });

    // Category breakdown
    const categoryCounts: Record<string, { events: number; registrations: number }> = {};
    for (const ev of eventSummaries) {
      if (!categoryCounts[ev.category]) {
        categoryCounts[ev.category] = { events: 0, registrations: 0 };
      }
      categoryCounts[ev.category].events += 1;
      categoryCounts[ev.category].registrations += ev.registered;
    }

    const dataContext = {
      system_overview: {
        total_events: totalEvents,
        total_registrations: totalRegistrations,
        total_users: totalUsers,
        venues: activeVenues,
      },
      category_breakdown: categoryCounts,
      events: eventSummaries,
      user_context: {
        user_name: user.full_name,
        user_role: user.role,
        registered_events: userBookings,
      },
      request: {
        mode: requestedMode,
        query: queryPrompt || "Provide comprehensive data analysis and recommendations for our campus event system.",
      },
    };

    let aiOutput = "";
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const systemInstruction = `You are the Campus Event Management System AI Analyst and Advisor.
Your objective is to provide intelligent data-driven analysis and actionable recommendations based on real campus event management metrics.

Guidelines:
1. Speak professionally, objectively, and insightfully.
2. Structure your response with clear sections:
   - 📊 **Executive Overview**: High-level observations and metrics breakdown.
   - 💡 **Key Data Insights**: Concrete observations regarding attendance, capacity utilization, venue popularity, or scheduling patterns.
   - 🎯 **Actionable Recommendations**: Clear, specific recommendations (e.g. adjust capacity, schedule complementary workshops, increase promotional outreach for under-registered events, or event suggestions for students).
   - 🚀 **Suggested Next Steps**: 2-3 immediate, practical actions the user can take.
3. Tailor the tone and recommendations based on the user's role:
   - If user role is "admin" or "organizer": Focus heavily on management data analytics, venue optimization, low-turnout risks, capacity balancing, and attendance boosting strategies.
   - If user role is "attendee": Focus on personalized event recommendations matching their interests, upcoming schedule, and seat availability.
4. Use formatting like bullet points and bold headers for maximum scannability. Keep numbers grounded in the provided data.`;

        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: [
            {
              role: "user",
              parts: [
                { text: `Here is the current live campus event data:\n${JSON.stringify(dataContext, null, 2)}\n\nUser Question/Request: ${queryPrompt || "Analyze our management data and provide recommendations."}` },
              ],
            },
          ],
          config: {
            systemInstruction,
            temperature: 0.3,
          },
        });

        aiOutput = response.text || "";
      } catch (genAiError: any) {
        console.error("Gemini API call failed, using rule-based analyst fallback:", genAiError?.message || genAiError);
      }
    }

    // Fallback if Gemini key is not configured or error occurred
    if (!aiOutput) {
      const upcomingEvents = eventSummaries.filter((e) => e.is_upcoming);
      const lowTurnout = upcomingEvents.filter((e) => parseFloat(e.occupancy_rate) < 20);
      const popularEvents = [...eventSummaries].sort((a, b) => b.registered - a.registered);

      if (user.role === "attendee") {
        const registeredIds = new Set(userBookings.map((b) => b.event_id));
        const recommended = upcomingEvents.filter((e) => !registeredIds.has(e.id));

        aiOutput = `### 🎯 Personalized Event Recommendations for ${user.full_name}

#### 📊 Your Participation Profile
- You are currently registered for **${userBookings.length} event(s)**: ${userBookings.map((b) => b.title).join(", ") || "None yet"}.
- There are **${upcomingEvents.length} active upcoming campus events** ready for booking.

#### 💡 Top Recommended Events For You
${recommended.length > 0 ? recommended.slice(0, 3).map((e) => `- **${e.title}** (${e.category})\n  - 📅 **Date & Time**: ${e.date} at ${e.time}\n  - 📍 **Venue**: ${e.venue}\n  - 🎟️ **Availability**: ${e.capacity - e.registered} open seats remaining (${e.occupancy_rate} booked)`).join("\n\n") : "- All current upcoming events are already in your booking roster!"}

#### 🚀 Recommended Action
Head over to the **Events Catalog** tab to secure your seat before popular venues reach maximum capacity!`;
      } else {
        aiOutput = `### 📊 Campus Management Data Analysis & Strategic Recommendations

#### 📈 Executive Overview
- **Total Catalog Events**: ${totalEvents} across ${activeVenues.length} campus venues (${activeVenues.join(", ")}).
- **Total Registrations**: ${totalRegistrations} across ${totalUsers} campus accounts.
- **Active Upcoming Events**: ${upcomingEvents.length} scheduled.

#### 💡 Key Data Insights
1. **Attendance Distribution**: Highest registered event is **"${popularEvents[0]?.title || "N/A"}"** with ${popularEvents[0]?.registered || 0} participants (${popularEvents[0]?.occupancy_rate || "0%"} capacity).
2. **Turnout Alert**: ${lowTurnout.length > 0 ? `Found **${lowTurnout.length} upcoming event(s)** with under 20% registration occupancy (${lowTurnout.map((e) => e.title).join(", ")}).` : "All upcoming events show healthy registration momentum."}
3. **Category Breakdown**:
${Object.entries(categoryCounts).map(([cat, info]) => `   - **${cat}**: ${info.events} event(s) with ${info.registrations} total registration(s)`).join("\n")}

#### 🎯 Actionable Management Recommendations
- **Boost Promotion for Low Occupancy**: Schedule campus broadcast announcements for under-subscribed sessions.
- **Venue Load Balancing**: Ensure peak times in "${activeVenues[0] || "Auditorium"}" have adequate AV and registration check-in staff.
- **Diversify Schedules**: Expand high-demand categories where student registration density is greatest.

#### 🚀 Suggested Next Steps
1. Review participant rosters in the **Participants** tab.
2. Export the latest registration report via the **Reports** tab to review with the organizing committee.`;
      }
    }

    res.json({
      ok: true,
      analysis: aiOutput,
      mode: requestedMode,
      model: apiKey ? "gemini-3.8-flash" : "rule-based-analyst (live data)",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("AI Assistant Error:", err);
    res.status(500).json({ detail: "An error occurred while generating AI analysis: " + (err?.message || "Internal error") });
  }
});

// --- Static Frontend Serving ---
const possibleFrontendDirs = [
  path.join(process.cwd(), "frontend"),
  path.join(__dirname, "frontend"),
  path.join(__dirname, "../frontend"),
];
const frontendDir = possibleFrontendDirs.find((dir) => fs.existsSync(dir)) || path.join(process.cwd(), "frontend");

app.use(express.static(frontendDir));

app.get("*", (_req, res) => {
  const indexPath = path.join(frontendDir, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("Not found");
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Campus EMS server listening on http://0.0.0.0:${PORT}`);
});
