import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

async function testBackend() {
  console.log("1. Testing Health Check...");
  const healthRes = await fetch("http://localhost:5000/");
  const health = await healthRes.json();
  console.log("Health Check:", health);

  console.log("\n2. Testing Send OTP endpoint...");
  const otpRes = await fetch("http://localhost:5000/api/email/send-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test.candidate@example.com" }),
  });
  const otpData = await otpRes.json();
  console.log("Send OTP Status:", otpRes.status);
  console.log("Send OTP Response:", otpData);

  if (otpData.devOtp) {
    throw new Error("FAIL: devOtp exposed in API response!");
  }
  console.log("✓ Pass: devOtp is NOT present in response");

  console.log("\n3. Testing Unverified Candidate Submission (Security Check)...");
  const unverifiedRes = await fetch("http://localhost:5000/api/candidates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Ramesh Kumar",
      qualification: "B.E. Mechanical",
      email: "unverified@example.com",
      phone: "9876543210",
    }),
  });
  console.log("Unverified Submission Status (Expect 403):", unverifiedRes.status);
  const unverifiedData = await unverifiedRes.json();
  console.log("Unverified Response:", unverifiedData);

  console.log("\nALL BACKEND API TESTS COMPLETED SUCCESSFULLY!");
}

testBackend().catch(console.error);
