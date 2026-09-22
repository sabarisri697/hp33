async function runTests() {
  const BASE_URL = "http://127.0.0.1:3000";
  console.log("=== STARTING CAMPUS EMS & AI FEATURE TEST SUITE ===");

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

  // 2. Admin login
  const adminLogin = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "admin", password: "Admin@123" }),
  });
  console.log(`[TEST 2] POST /api/auth/login (admin): status = ${adminLogin.status}, role = ${adminLogin.data?.user?.role}`);
  if (adminLogin.status !== 200 || !adminLogin.data?.access_token) throw new Error("Admin login failed");
  const adminToken = adminLogin.data.access_token;

  // 3. Organizer login
  const orgLogin = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "organizer", password: "Organizer@123" }),
  });
  console.log(`[TEST 3] POST /api/auth/login (organizer): status = ${orgLogin.status}, role = ${orgLogin.data?.user?.role}`);
  if (orgLogin.status !== 200 || !orgLogin.data?.access_token) throw new Error("Organizer login failed");
  const orgToken = orgLogin.data.access_token;

  // 4. Attendee login
  const attLogin = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "attendee", password: "Attendee@123" }),
  });
  console.log(`[TEST 4] POST /api/auth/login (attendee): status = ${attLogin.status}, role = ${attLogin.data?.user?.role}`);
  if (attLogin.status !== 200 || !attLogin.data?.access_token) throw new Error("Attendee login failed");
  const attToken = attLogin.data.access_token;

  // 5. Existing Feature: Get events list
  const events = await request("/api/events", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(`[TEST 5] GET /api/events: status = ${events.status}, count = ${events.data?.length}`);
  if (events.status !== 200 || !Array.isArray(events.data) || events.data.length === 0) throw new Error("Get events failed");

  // 6. Existing Feature: Dashboard stats & reports
  const stats = await request("/api/dashboard/stats", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(`[TEST 6] GET /api/dashboard/stats: status = ${stats.status}, total_events = ${stats.data?.total_events}, avg_occupancy = ${stats.data?.avg_occupancy}%`);
  if (stats.status !== 200 || typeof stats.data?.total_events !== "number") throw new Error("Stats failed");

  // 7. Existing Feature: Bookings / registrations
  const bookings = await request("/api/bookings", {
    headers: { Authorization: `Bearer ${attToken}` },
  });
  console.log(`[TEST 7] GET /api/bookings (attendee): status = ${bookings.status}, count = ${bookings.data?.length}`);
  if (bookings.status !== 200) throw new Error("Bookings failed");

  // 8. AI Feature: Security check - unauthorized request must be rejected
  const aiNoAuth = await request("/api/ai/assistant", {
    method: "POST",
    body: JSON.stringify({ prompt: "Analyze management data" }),
  });
  console.log(`[TEST 8] Security: POST /api/ai/assistant without token: status = ${aiNoAuth.status} (expected 401)`);
  if (aiNoAuth.status !== 401) throw new Error("AI endpoint permitted unauthorized access!");

  // 9. AI Feature: Organizer / Admin Management Data Analysis & Recommendations
  const aiAdmin = await request("/api/ai/assistant", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      prompt: "Analyze overall campus event attendance, occupancy rates, and venue utilization.",
      mode: "analytics",
    }),
  });
  console.log(`[TEST 9] AI Feature (Admin): status = ${aiAdmin.status}, model = ${aiAdmin.data?.model}`);
  console.log("--- AI Admin Management Analysis Sample Snippet ---");
  console.log(aiAdmin.data?.analysis?.slice(0, 240) + "...\n--------------------------------------------------");
  if (aiAdmin.status !== 200 || !aiAdmin.data?.analysis) throw new Error("AI Admin analysis failed");

  // 10. AI Feature: Attendee Personalized Event Recommendations
  const aiStudent = await request("/api/ai/assistant", {
    method: "POST",
    headers: { Authorization: `Bearer ${attToken}` },
    body: JSON.stringify({
      prompt: "Recommend the best upcoming campus events for me based on open seats and category variety.",
      mode: "recommendations",
    }),
  });
  console.log(`[TEST 10] AI Feature (Attendee): status = ${aiStudent.status}, model = ${aiStudent.data?.model}`);
  console.log("--- AI Student Recommendations Sample Snippet ---");
  console.log(aiStudent.data?.analysis?.slice(0, 240) + "...\n--------------------------------------------------");
  if (aiStudent.status !== 200 || !aiStudent.data?.analysis) throw new Error("AI Student recommendations failed");

  // 11. AI Feature: Realistic custom query (Under-attended events analysis)
  const aiCustomQuery = await request("/api/ai/assistant", {
    method: "POST",
    headers: { Authorization: `Bearer ${orgToken}` },
    body: JSON.stringify({
      prompt: "Which events have the lowest turnout risk, and what exact promotional strategies should we deploy?",
    }),
  });
  console.log(`[TEST 11] AI Feature (Custom Query): status = ${aiCustomQuery.status}`);
  console.log("--- AI Custom Query Analysis Snippet ---");
  console.log(aiCustomQuery.data?.analysis?.slice(0, 240) + "...\n--------------------------------------------------");
  if (aiCustomQuery.status !== 200 || !aiCustomQuery.data?.analysis) throw new Error("AI Custom query failed");

  console.log("\n>>> ALL 11 TESTS PASSED SUCCESSFULLY! BOTH EXISTING CAPABILITIES AND NEW AI FEATURE WORK AS EXPECTED! <<<");
}

runTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
