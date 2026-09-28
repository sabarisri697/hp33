async function runTests() {
  const BASE_URL = process.env.TEST_URL || "http://127.0.0.1:3000";
  console.log(`=== STARTING CAMPUS EMS TEST SUITE on ${BASE_URL} ===`);

  // Helper
  async function request(path: string, options: any = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const status = res.status;
    let data = null;
    try {
      data = await res.json();
    } catch {
      // ignore
    }
    return { status, data };
  }

  // 1. Health check
  const health = await request("/api/health");
  console.log(`[TEST 1] GET /api/health: status = ${health.status}, statusText = ${health.data?.status}`);
  if (health.status !== 200 || health.data?.status !== "ok") throw new Error("Health check failed");

  // 2. Auth: Admin login
  const adminLogin = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "admin", password: "Admin@123" }),
  });
  console.log(`[TEST 2] POST /api/auth/login (admin): status = ${adminLogin.status}, role = ${adminLogin.data?.user?.role}`);
  if (adminLogin.status !== 200 || !adminLogin.data?.access_token) throw new Error("Admin login failed");
  const adminToken = adminLogin.data.access_token;

  // 3. Auth: Organizer login
  const orgLogin = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "organizer", password: "Organizer@123" }),
  });
  console.log(`[TEST 3] POST /api/auth/login (organizer): status = ${orgLogin.status}, role = ${orgLogin.data?.user?.role}`);
  if (orgLogin.status !== 200 || !orgLogin.data?.access_token) throw new Error("Organizer login failed");
  const orgToken = orgLogin.data.access_token;

  // 4. Auth: Attendee login
  const attLogin = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "attendee", password: "Attendee@123" }),
  });
  console.log(`[TEST 4] POST /api/auth/login (attendee): status = ${attLogin.status}, role = ${attLogin.data?.user?.role}`);
  if (attLogin.status !== 200 || !attLogin.data?.access_token) throw new Error("Attendee login failed");
  const attToken = attLogin.data.access_token;

  // 5. Auth Error Handling: Invalid credentials rejected
  const badLogin = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "admin", password: "WrongPassword!" }),
  });
  console.log(`[TEST 5] Auth Security: Invalid credentials rejected with status = ${badLogin.status} (expected 401)`);
  if (badLogin.status !== 401) throw new Error("Invalid login was not rejected!");

  // 6. Events: Read catalog
  const events = await request("/api/events", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(`[TEST 6] GET /api/events: status = ${events.status}, count = ${events.data?.length}`);
  if (events.status !== 200 || !Array.isArray(events.data) || events.data.length === 0) throw new Error("Get events failed");

  // 7. Events CRUD: Organizer creates a new event
  const newEventRes = await request("/api/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${orgToken}` },
    body: JSON.stringify({
      title: "Automated Deployment Test Workshop",
      category: "Technology",
      date: new Date(Date.now() + 86400000 * 15).toISOString().slice(0, 10),
      time: "15:00",
      venue: "Lab 4",
      capacity: 40,
    }),
  });
  console.log(`[TEST 7] POST /api/events (create): status = ${newEventRes.status}, id = ${newEventRes.data?.id}`);
  if (newEventRes.status !== 201 || !newEventRes.data?.id) throw new Error("Create event failed");
  const createdEventId = newEventRes.data.id;

  // 8. Bookings CRUD: Attendee books seat in newly created event
  const bookingRes = await request(`/api/events/${createdEventId}/register`, {
    method: "POST",
    headers: { Authorization: `Bearer ${attToken}` },
  });
  console.log(`[TEST 8] POST /api/bookings (create booking): status = ${bookingRes.status}, code = ${bookingRes.data?.confirmation_code}`);
  if (bookingRes.status !== 201 || !bookingRes.data?.confirmation_code) throw new Error("Booking seat failed");
  const createdBookingId = bookingRes.data.id;

  // 9. Bookings: Read user bookings
  const bookingsRes = await request("/api/bookings", {
    headers: { Authorization: `Bearer ${attToken}` },
  });
  const hasCreatedBooking = bookingsRes.data?.some((b: any) => b.id === createdBookingId);
  console.log(`[TEST 9] GET /api/bookings: status = ${bookingsRes.status}, verified booking present = ${hasCreatedBooking}`);
  if (bookingsRes.status !== 200 || !hasCreatedBooking) throw new Error("Created booking missing from bookings list");

  // 10. Bookings CRUD: Attendee cancels booking
  const cancelBookingRes = await request(`/api/bookings/${createdBookingId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${attToken}` },
  });
  console.log(`[TEST 10] DELETE /api/bookings/:id: status = ${cancelBookingRes.status}`);
  if (cancelBookingRes.status !== 200 && cancelBookingRes.status !== 204) throw new Error("Cancel booking failed");

  // 11. Events CRUD: Clean up test event
  const deleteEventRes = await request(`/api/events/${createdEventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${orgToken}` },
  });
  console.log(`[TEST 11] DELETE /api/events/:id: status = ${deleteEventRes.status}`);
  if (deleteEventRes.status !== 200 && deleteEventRes.status !== 204) throw new Error("Delete event failed");

  // 12. Dashboard stats & occupancy calculation
  const stats = await request("/api/dashboard/stats", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(`[TEST 12] GET /api/dashboard/stats: status = ${stats.status}, total_events = ${stats.data?.total_events}, avg_occupancy = ${stats.data?.avg_occupancy}%`);
  if (stats.status !== 200 || typeof stats.data?.total_events !== "number") throw new Error("Stats failed");

  // 13. Reports summary
  const reports = await request("/api/reports/summary", {
    headers: { Authorization: `Bearer ${orgToken}` },
  });
  console.log(`[TEST 13] GET /api/reports/summary: status = ${reports.status}, total_bookings = ${reports.data?.total_bookings}`);
  if (reports.status !== 200) throw new Error("Reports summary failed");

  // 14. AI Security: Unauthenticated request must be rejected (401)
  const aiNoAuth = await request("/api/ai/assistant", {
    method: "POST",
    body: JSON.stringify({ prompt: "Analyze management data" }),
  });
  console.log(`[TEST 14] AI Security: POST /api/ai/assistant without token: status = ${aiNoAuth.status} (expected 401)`);
  if (aiNoAuth.status !== 401) throw new Error("AI endpoint permitted unauthorized access!");

  // 15. AI Feature: Organizer / Admin Management Data Analysis & Recommendations
  const aiAdmin = await request("/api/ai/assistant", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      prompt: "Analyze overall campus event attendance, occupancy rates, and venue utilization.",
      mode: "analytics",
    }),
  });
  console.log(`[TEST 15] AI Feature (Admin): status = ${aiAdmin.status}, model = ${aiAdmin.data?.model}`);
  console.log("--- AI Admin Management Analysis Sample Snippet ---");
  console.log((aiAdmin.data?.analysis || "").slice(0, 240) + "...\n--------------------------------------------------");
  if (aiAdmin.status !== 200 || !aiAdmin.data?.analysis) throw new Error("AI Admin analysis failed");

  // 16. AI Feature: Attendee Personalized Event Recommendations
  const aiStudent = await request("/api/ai/assistant", {
    method: "POST",
    headers: { Authorization: `Bearer ${attToken}` },
    body: JSON.stringify({
      prompt: "Recommend the best upcoming campus events for me based on open seats and category variety.",
      mode: "recommendations",
    }),
  });
  console.log(`[TEST 16] AI Feature (Attendee): status = ${aiStudent.status}, model = ${aiStudent.data?.model}`);
  console.log("--- AI Student Recommendations Sample Snippet ---");
  console.log((aiStudent.data?.analysis || "").slice(0, 240) + "...\n--------------------------------------------------");
  if (aiStudent.status !== 200 || !aiStudent.data?.analysis) throw new Error("AI Student recommendations failed");

  console.log("\n>>> ALL 16 TESTS PASSED SUCCESSFULLY! FULL-STACK CAPABILITIES, CRUDS, AUTH, AND AI VERIFIED! <<<");
}

runTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
