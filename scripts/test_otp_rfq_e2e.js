import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

async function runTest() {
  console.log("==================================================");
  console.log(" TESTING RFQ OTP VERIFICATION AND PROTECTION ");
  console.log("==================================================");

  console.log("\n--- TEST 1: Attempt RFQ without OTP verification token ---");
  const unverifiedRfqRes = await fetch("http://localhost:5000/api/rfq", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Ramesh Kumar",
      company: "AutoPlant Dynamics Pvt Ltd",
      email: "operations@autoplant.com",
      phone: "9840112233",
      industry: "Automotive & Auto Components",
      service: "Bulk Assembly Workforce",
      headcount: "50 Operators",
    }),
  });
  console.log("Unverified RFQ Status (Expected 403):", unverifiedRfqRes.status);
  const unverifiedData = await unverifiedRfqRes.json();
  console.log("Unverified RFQ response:", unverifiedData);

  console.log("\n--- TEST 2: Request Real OTP via /api/email/send-otp ---");
  const sendRes = await fetch("http://localhost:5000/api/email/send-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "operations@autoplant.com" }),
  });
  const sendData = await sendRes.json();
  console.log("Send OTP Status:", sendRes.status);
  console.log("Send OTP Response (devOtp MUST NOT exist):", sendData);

  if (sendData.devOtp) {
    throw new Error("FAIL: devOtp found in API response!");
  }
  console.log("✓ Pass: No devOtp exposed");
}

runTest().catch(console.error);
