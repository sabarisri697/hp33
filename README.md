# Campus Event Management System (Campus EMS)

A modern, full-stack, production-ready Progressive Web Application (PWA) and RESTful API for college event planning, seat bookings, participant management, analytics, and intelligent campus advising.

Built with **Node.js, Express, TypeScript, and Google Gemini AI**, paired with a responsive, offline-capable frontend.

---

## 🚀 Key Features

- **Role-Based Access Control (RBAC)**: Distinct permissions and personalized dashboards for **Admin**, **Organizer**, and **Attendee** roles.
- **Secure Authentication**: Salted SHA-256 password hashing with unique 16-character cryptographic salts and signed JWT session tokens.
- **Event Lifecycle Management**: Organizers and Admins can create, schedule, edit, cancel, and remove campus events across multiple venues.
- **Live Seat Booking & Confirmation Codes**: Attendees can register for upcoming sessions, avoid over-capacity bookings, receive unique confirmation codes (`EMS-XXXXXXXX`), and manage their registrations.
- **Participant Rosters & Reports**: Organizers and Admins can filter attendees by event, search registrations, and download audit-ready CSV exports.
- **Management Analytics**: Real-time venue occupancy rates, active participant statistics, and category distributions.
- **✨ Intelligent AI Analyst & Advisor**: Powered by **Google Gemini 3.8 Flash** (`@google/genai`) with role-aware insights:
  - **Admin / Organizer**: Capacity utilization alerts, under-booked session diagnosis, venue load balancing recommendations.
  - **Attendee**: Personalized event recommendations based on registration history and open campus venues.
  - Includes a zero-downtime rule-based analyst fallback if an API key is not yet configured.
- **Progressive Web App (PWA)**: Offline cache fallbacks, web app manifest, custom icons, and installable app shell.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, CSS3, Vanilla ES6+ JavaScript, Service Worker (PWA), Web App Manifest |
| **Backend** | Node.js (v20+ / v22+), Express 4, TypeScript 5 |
| **Authentication** | JSON Web Tokens (`jsonwebtoken`), Cryptographic SHA-256 Salted Hashing |
| **AI Integration** | Google Gemini (`@google/genai` TypeScript SDK with model `gemini-3.8-flash`) |
| **Build & Tooling** | esbuild, tsx, TypeScript compiler |

---

## 👥 Demo Accounts

The application automatically seeds ready-to-test accounts on launch:

| Role | Username | Password | Default Capabilities |
|---|---|---|---|
| **Admin** | `admin` | `Admin@123` | Full system access, student CRUD, all events, campus-wide reports & AI analytics |
| **Organizer** | `organizer` | `Organizer@123` | Create & manage events, manage participant rosters, export CSV reports |
| **Attendee** | `attendee` | `Attendee@123` | Browse catalog, book seats, view confirmation codes, AI event recommendations |

---

## ⚙️ Environment Variables

Configure the following variables in your hosting environment or `.env` file (see `.env.example`):

```bash
# Server Port (defaults to 3000 or Cloud Provider's PORT)
PORT=3000

# Secret key used for signing JWT authentication tokens
JWT_SECRET=your-production-jwt-secret-key-change-in-production

# Google Gemini API Key for server-side AI features
GEMINI_API_KEY=your-gemini-api-key
```

---

## 💻 Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/sabarisri697/hp33.git
   cd hp33
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. **Run test suite**:
   ```bash
   npm test
   ```

---

## 📦 Production Build & Deployment

### Build Command
```bash
npm run build
```
Uses `esbuild` to compile and bundle `server.ts` into a production-optimized package.

### Start Command
```bash
npm start
```
Starts the production server (`node server.ts`), binding dynamically to `0.0.0.0:${PORT}`.

### Container & Cloud Deployment (Docker / Cloud Run / App Engine / Render)
Deployable as a standard Node.js container or service:
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
EXPOSE 3000
ENV PORT=3000
CMD ["npm", "start"]
```

---

## 📡 REST API Reference

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | Service health probe |
| `POST` | `/api/auth/register` | Public | Register a new attendee or organizer |
| `POST` | `/api/auth/login` | Public | Authenticate user & issue JWT |
| `GET` | `/api/auth/me` | Authenticated | Retrieve current authenticated user profile |
| `GET` | `/api/events` | Public | List catalog events with query filters |
| `POST` | `/api/events` | Staff | Create a new campus event |
| `GET` | `/api/events/:id` | Public | Get single event details |
| `PUT` | `/api/events/:id` | Staff | Update or cancel an event |
| `DELETE` | `/api/events/:id` | Staff | Remove an event |
| `GET` | `/api/bookings` | Authenticated | List bookings for current user |
| `POST` | `/api/bookings` | Authenticated | Reserve a seat for an event |
| `DELETE` | `/api/bookings/:id` | Authenticated | Cancel a seat reservation |
| `GET` | `/api/participants` | Staff | View participant roster |
| `GET` | `/api/dashboard/stats` | Authenticated | View system statistics and occupancy |
| `GET` | `/api/reports/summary` | Staff | View event and attendance reports |
| `GET` | `/api/reports/export/events.csv` | Staff | Export events report as CSV |
| `GET` | `/api/reports/export/participants.csv` | Staff | Export participants roster as CSV |
| `GET` | `/api/users` | Admin | List registered user accounts |
| `POST` | `/api/users` | Admin | Create a new user account |
| `PUT` | `/api/users/:id` | Admin | Update user details or reset password |
| `DELETE` | `/api/users/:id` | Admin | Delete user account |
| `POST` | `/api/ai/assistant` | Authenticated | Gemini-powered campus analysis & recommendations |

---

## 🧪 Testing & Quality Assurance

Run the automated validation suite covering authentication, authorization, CRUD operations, and Gemini AI:
```bash
npm test
```
Run type-checking:
```bash
npm run lint
```
