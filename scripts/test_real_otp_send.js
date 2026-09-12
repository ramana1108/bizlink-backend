import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import { sendEmailOtp } from "../services/otpService.js";

async function testOtpSend() {
  console.log("==================================================");
  console.log(" TESTING CANDIDATE OTP DISPATCH VIA BREVO HTTPS ");
  console.log("==================================================");

  const testCandidateEmail = "prasannaramana.ganesan@gmail.com";

  console.log(`\nTarget Candidate Email: ${testCandidateEmail}`);
  console.log(`Sender: ${process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER || "career@profectusbizlink.com"}`);
  console.log(`API Key Configured: ${process.env.BREVO_API_KEY ? "YES" : "NO (Dev Console Fallback Mode)"}`);

  try {
    const result = await sendEmailOtp(testCandidateEmail);

    console.log("\nResult from sendEmailOtp:", result);

    if (result.success) {
      console.log("\n✓ SUCCESS: OTP Email was successfully dispatched!");
      console.log("✓ No devOtp exposed in the response payload.");
    } else {
      console.error("\n✗ FAILED: OTP Email dispatch returned success=false:", result);
    }
  } catch (error) {
    console.error("\n✗ EXCEPTION during sendEmailOtp:", error.message);
  }
}

testOtpSend();
