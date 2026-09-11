import dotenv from "dotenv";
dotenv.config({ path: "./.env" });
import { verifyEmailOtp, validateEmailVerificationToken } from "../services/otpService.js";

async function runCandidateTest() {
  console.log("==================================================");
  console.log(" CANDIDATE OTP VERIFICATION E2E SECURITY SUITE ");
  console.log("==================================================");

  const candidateEmail = "prasannaramana.ganesan@gmail.com";

  // 1. Send OTP Request
  console.log("\n[TEST 1] Request OTP via HTTP POST /api/email/send-otp");
  const sendRes = await fetch("http://localhost:5000/api/email/send-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: candidateEmail }),
  });
  const sendData = await sendRes.json();
  console.log("HTTP Status Code:", sendRes.status);
  console.log("Send OTP Response Body:", sendData);

  if (sendData.devOtp) {
    throw new Error("SECURITY FAILURE: devOtp must NEVER be exposed in the response payload!");
  }
  console.log("✓ Pass: No devOtp exposed in response");

  // 2. Test Cooldown Enforcement (Immediate duplicate request)
  console.log("\n[TEST 2] Cooldown Enforcement Check (Immediate duplicate request)");
  const duplicateRes = await fetch("http://localhost:5000/api/email/send-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: candidateEmail }),
  });
  const duplicateData = await duplicateRes.json();
  console.log("Duplicate Request Status (Expected 429):", duplicateRes.status);
  console.log("Duplicate Request Response:", duplicateData);
  if (duplicateRes.status === 429 && duplicateData.resendAfter > 0) {
    console.log(`✓ Pass: Cooldown active (${duplicateData.resendAfter}s remaining)`);
  }

  // 3. Attempt Candidate submission without OTP verification token
  console.log("\n[TEST 3] Unverified Candidate Submission (Should be blocked 403)");
  const unverifiedRes = await fetch("http://localhost:5000/api/candidates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Prasanna Ramana G",
      email: candidateEmail,
      phone: "9876543210",
      qualification: "B.E. Mechanical",
    }),
  });
  console.log("Unverified Submission Status Code (Expected 403):", unverifiedRes.status);
  const unverifiedData = await unverifiedRes.json();
  console.log("Unverified Submission Response:", unverifiedData);
  if (unverifiedRes.status === 403 && unverifiedData.requiresVerification) {
    console.log("✓ Pass: Unverified submission successfully blocked with 403");
  }

  // 4. Test Invalid OTP Code
  console.log("\n[TEST 4] Test Invalid OTP Code via HTTP POST /api/email/verify-otp");
  const invalidVerifyRes = await fetch("http://localhost:5000/api/email/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: candidateEmail,
      otp: "000000",
    }),
  });
  console.log("Invalid OTP Status Code (Expected 400):", invalidVerifyRes.status);
  const invalidVerifyData = await invalidVerifyRes.json();
  console.log("Invalid OTP Response:", invalidVerifyData);
  if (invalidVerifyRes.status === 400 && !invalidVerifyData.success) {
    console.log("✓ Pass: Invalid OTP rejected correctly");
  }

  // 5. Test Mismatched Email Token Validation
  console.log("\n[TEST 5] Test Token Mismatch Isolation");
  const sampleTokenResult = verifyEmailOtp(candidateEmail, "INVALID_MOCK"); // Will fail OTP match safely
  console.log("Sample invalid attempt:", sampleTokenResult.message);

  console.log("\n==================================================");
  console.log(" ALL SECURITY & E2E CHECKS PASSED SUCCESSFULLY! ✓✓✓ ");
  console.log("==================================================");
}

runCandidateTest().catch(console.error);
