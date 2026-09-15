# Software Requirements Specification (SRS)
## Campus Event Management System (EMS)

### 1. Purpose and Scope

**Purpose:**  
This document defines the official software requirements for the Campus Event Management System (EMS). The system enables college event organizers and administrators to create and manage events, while allowing students and attendees to browse listings, search and filter events, and register for seats.

**In Scope (Version 1.0):**
- User account registration and authentication for Organizers, Attendees, and Administrators.
- Admin and Organizer event management (creating, updating, cancelling, and deleting events).
- Searchable and filterable event catalog (filtering by category, venue, date, and timeframe).
- Event seat booking with unique confirmation code generation (`EMS-XXXXXX`) and booking cancellation.
- Attendee roster management per event with CSV export capability.
- Admin student and staff account management (create, search, update, delete).
- Dashboard statistics, recent activity stream, and system-wide CSV report generation.
- Audit logging for all failed login attempts.

**Out of Scope (Version 1.0):**
- Online payment processing or ticket purchasing.
- Third-party email/SMS gateways.
- Mobile native apps (iOS / Android).
- QR code-based check-in hardware scanners.
- Multi-language localization.

---

### 2. Functional Requirements

- **FR-01 (Authentication):** The system shall allow users to register as an Organizer or Attendee, and authenticate users using a username and password.
- **FR-02 (Event Management):** The system shall allow authorized Organizers and Admins to create, edit, cancel, and delete events specifying title, category, date, time, venue, and seat capacity.
- **FR-03 (Event Catalog & Filtering):** The system shall display upcoming and past events, supporting real-time database search by title, venue, or category, and filtering by category, venue, date, and timeframe.
- **FR-04 (Seat Booking):** The system shall permit authenticated users to register for active upcoming events with available capacity, generating a unique ticket confirmation code.
- **FR-05 (Roster & CSV Export):** The system shall allow Organizers and Admins to view event participant rosters and export attendee lists as CSV files.
- **FR-06 (User Management):** The system shall allow Admins to manage user accounts (create, search, update details, or delete accounts).
- **FR-07 (Reporting & Dashboard):** The system shall generate summary statistics (occupancy rates, active venues, total bookings) and allow exporting event reports as CSV files.
- **FR-08 (Security Audit Logging):** The system shall log all failed login attempts into the database for security monitoring.

---

### 3. Non-Functional Requirements

- **NFR-01 (Performance):** The system shall execute database queries and render results within 2.0 seconds under normal load.
- **NFR-02 (Security):** User passwords shall be stored using cryptographic hashing with a 16-character salt. Plain-text passwords shall never be persisted.
- **NFR-03 (Authorization):** Administrative features (user management, report export, cross-organizer event editing) shall be strictly restricted to users with the "admin" role.
- **NFR-04 (Scalability):** The system shall support at least 500 registered users and up to 50 concurrent active users without performance degradation.
- **NFR-05 (Usability):** Core user features (browsing events, booking a seat, viewing bookings) shall be navigable within 3 clicks from the dashboard.
- **NFR-06 (Reliability & Persistence):** System restarts shall not cause loss of stored user, event, or registration data in MongoDB.

---

### 4. System Constraints & Assumptions

**Assumptions:**
- Users access the application using standard modern web browsers (Chrome, Edge, Firefox, Safari).
- Event capacity and user data volumes reflect campus-scale usage (hundreds of records).
- All seat registrations are free or simulated without monetary transactions.

**Constraints:**
- The backend must be developed using **Python** and **MongoDB**.
- The frontend must be lightweight and accessible via static web hosting.
- The system must not rely on external paid third-party APIs.

