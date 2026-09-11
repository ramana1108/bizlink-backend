import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import { sendEmailOtp } from "../services/otpService.js";

async function testOtpSend() {
  console.log("==================================================");
  console.log(" TESTING REAL CANDIDATE OTP DISPATCH VIA SMTP ");
  console.log("==================================================");

  const testCandidateEmail = "prasannaramana.ganesan@gmail.com";

  console.log(`\nTarget Candidate Email: ${testCandidateEmail}`);
  console.log(`SMTP Host: ${process.env.SMTP_HOST}`);
  console.log(`SMTP User / Sender: ${process.env.SMTP_USER}`);

  try {
    const result = await sendEmailOtp(testCandidateEmail);

    console.log("\nResult from sendEmailOtp:", result);

    if (result.success) {
      console.log("\n✓ SUCCESS: OTP Email was successfully dispatched to candidate's inbox!");
      console.log("✓ No devOtp exposed in the response payload.");
    } else {
      console.error("\n✗ FAILED: OTP Email dispatch returned success=false:", result);
    }
  } catch (error) {
    console.error("\n✗ EXCEPTION during sendEmailOtp:", error.message);
  }
}

testOtpSend();
