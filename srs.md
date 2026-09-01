## Purpose and Scope

**Purpose:** This document defines the software requirements for an Event Management System (EMS) that allows organizers to create and manage events and allows attendees to browse and register for them. It is intended to guide development, testing, and evaluation of the system as a college project.

**Scope:**

**In Scope (Version 1):**
- User registration and login for organizers and attendees
- Creating, editing, and deleting events
- Viewing a list of upcoming events with details
- Registering/booking a seat for an event
- Admin dashboard to manage all events and users
- Searching and filtering events by date, category, or venue

**Out of Scope (Version 1):**
- Online payment or ticket purchasing
- Email/SMS notifications
- Mobile app version
- Multi-language support
- QR code-based check-in
- Integration with third-party calendars or social media

---

## Functional Requirements

- **FR-01:** The system shall allow users to register an account as an organizer or attendee.
- **FR-02:** The system shall allow registered users to log in using a username and password.
- **FR-03:** The system shall allow organizers to create, edit, and delete events.
- **FR-04:** The system shall display a list of upcoming events with event details.
- **FR-05:** The system shall allow attendees to register or book a seat for an event.
- **FR-06:** The system shall provide an admin dashboard to manage all events and users.
- **FR-07:** The system shall allow users to search events by date, category, or venue.
- **FR-08:** The system shall allow users to filter the event list by date, category, or venue.

---

## Non-Functional Requirements

- **NFR-01:** The system shall load the event list page within 3 seconds for up to 100 concurrent users.
- **NFR-02:** The system shall store user passwords using hashing with a minimum of SHA-256 strength.
- **NFR-03:** The system shall restrict admin dashboard access to users with an "admin" role only.
- **NFR-04:** The system shall support at least 500 registered users without performance degradation.
- **NFR-05:** The system shall have a user interface navigable within 3 clicks from the home page to any core feature.
- **NFR-06:** The system shall maintain 99% uptime during the 4-week evaluation/demo period.
- **NFR-07:** The system shall complete a seat booking transaction within 2 seconds under normal load.
- **NFR-08:** The system shall log all failed login attempts, retaining logs for a minimum of 30 days.

---

## Assumptions and Constraints

**Assumptions:**
- Only one developer or a small team (1–3 members) will build and maintain the system.
- The system will be used on a local machine or a single small server, not a distributed environment.
- Users will access the system via a web browser or simple desktop interface.
- Event data volume will remain small (hundreds, not millions, of records).
- No real payment processing is required; all bookings are free or simulated.

**Constraints:**
- The system must be built using Python as the primary programming language.
- The system must use SQLite as the database (no external database server).
- The project must be completed within a few weeks (college project timeline).
- The system must run on standard college lab hardware without special infrastructure.
- No budget is available for third-party paid APIs or cloud hosting services.
**Purpose and Scope**

This document specifies the software requirements for a lightweight Event Management System designed to simplify event administration and attendance tracking within a college environment.

**In Scope (Version 1.0)**

* User account registration and authentication.
* Admin-managed creation, update, and cancellation of events.
* A searchable catalog for browsing upcoming events.
* User registration and simple ticket confirmation generation.
* Admin access to attendee lists per event.
* Automated email confirmations and reminders.

**Out of Scope (Version 1.0)**

* Paid ticketing or payment gateway integration.
* Dynamic seating charts or interactive venue maps.
* Multi-role permission hierarchies beyond standard user and admin.
* Mobile application development.

---

**Functional Requirements**

* **FR-01:** The system shall authenticate standard users and administrators through a secure login and registration portal.
* **FR-02:** The system shall allow administrators to create, edit, and cancel events with details including date, time, venue, and capacity limit.
* **FR-03:** The system shall display a searchable catalog of upcoming events that allows users to filter listings by category.
* **FR-04:** The system shall permit authenticated users to register for available events and generate a unique registration confirmation code.
* **FR-05:** The system shall allow administrators to view and export the list of registered attendees for any selected event.
* **FR-06:** The system shall send an automated email confirmation upon event registration and a reminder email 24 hours prior to the event start time.

---

**Non-Functional Requirements**

* **NFR-01 (Speed):** The system shall render database query results and page loads within 2.0 seconds under normal operation.
* **NFR-02 (Security):** The system shall store all user passwords using SHA-256 hashing algorithms with a minimum 16-character salt.
* **NFR-03 (Usability):** The system shall enable a first-time user to complete an event registration in 3 or fewer clicks from the homepage.
* **NFR-04 (Reliability):** The system shall maintain an operational uptime of 99.0% during campus hours (8:00 AM to 8:00 PM).

---

**Assumptions and Constraints**

**Assumptions**

* Users have access to a desktop browser and a valid email address for receiving notifications.
* The expected simultaneous user count will not exceed 50 concurrent users.

**Constraints**

* The backend must be developed strictly using Python and SQLite.
* The local SQLite database file size must remain under 1 GB to maintain performance.
* All development, testing, and deployment must be completed within a 4-week timeline.
## 1. Purpose and Scope

**Purpose:**
The purpose of the Event Management System is to provide a simple system for managing college events, users, registrations, and participants using Python and SQLite.

**IN Scope:**

* User registration and login.
* Creating and managing events.
* Viewing upcoming and past events.
* Registering for events.
* Managing event participants.
* Generating simple event reports.

**OUT of Scope:**

* Online payment processing.
* Mobile application.
* Email or SMS notifications.
* Integration with external event platforms.
* Advanced analytics and reporting.

## 2. Functional Requirements

* **FR-01:** The system shall allow users to register and log in using valid credentials.
* **FR-02:** The system shall allow authorized users to create, update, and delete events.
* **FR-03:** The system shall allow users to view upcoming and past events.
* **FR-04:** The system shall allow users to register for available events.
* **FR-05:** The system shall allow authorized users to view and manage event participants.
* **FR-06:** The system shall generate simple reports containing event and participant information.

## 3. Non-Functional Requirements

* **NFR-01:** The system shall respond to normal user actions within **2 seconds**.
* **NFR-02:** The system shall store user passwords using **one-way hashing** and shall not store plain-text passwords.
* **NFR-03:** The system shall allow a new user to complete registration within **3 minutes**.
* **NFR-04:** The system shall maintain **99% data consistency** during normal database operations.
* **NFR-05:** The system shall support at least **50 concurrent registered users** during normal operation.
* **NFR-06:** The system shall recover from an application restart without losing successfully saved data.

## 4. Assumptions

* Users have basic computer and web/application usage knowledge.
* Python and SQLite are available on the development environment.
* The system will be used primarily for college events.
* Users will provide valid registration information.
* An administrator or authorized user will manage event information.

## 5. Constraints

* The system shall be developed using **Python**.
* **SQLite** shall be used as the database.
* The project shall be suitable for completion within **a few weeks**.
* The first version shall use a **simple user interface**.
* The system shall not depend on paid external services.
