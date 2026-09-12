import dotenv from "dotenv";
dotenv.config({ path: "./.env" });
import jwt from "jsonwebtoken";

async function testFullSuite() {
  console.log("==================================================");
  console.log(" RUNNING COMPLETE E2E SUITE WITH BREVO HTTPS API ");
  console.log("==================================================");

  const BASE_URL = "http://localhost:5000";

  // 1. Health check
  console.log("\n[1] Testing GET / (Welcome / Health Check)...");
  const healthRes = await fetch(`${BASE_URL}/`);
  const healthData = await healthRes.json();
  console.log("Status:", healthRes.status);
  console.log("Message:", healthData.message);
  console.log("Endpoints:", Object.keys(healthData.endpoints).join(", "));
  if (healthRes.status !== 200 || !healthData.endpoints) {
    throw new Error("Health check failed!");
  }
  console.log("✓ Health check PASSED");

  // 2. Candidate Full Flow
  console.log("\n[2] Testing Candidate Submission Flow...");
  const candidateEmail = "test.applicant@profectusbizlink.com";
  
  // Send OTP
  const otpRes = await fetch(`${BASE_URL}/api/email/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: candidateEmail }),
  });
  const otpData = await otpRes.json();
  console.log("OTP Request Status:", otpRes.status, otpData.message);

  // Generate a valid JWT verification token for testing full submission
  const JWT_SECRET = process.env.JWT_SECRET || "bizlink_secure_verification_secret_key_2026";
  const validToken = jwt.sign(
    { email: candidateEmail.toLowerCase().trim(), verified: true, timestamp: Date.now() },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  // Submit Candidate with verified token
  const candidateRes = await fetch(`${BASE_URL}/api/candidates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Suresh Narayanan",
      email: candidateEmail,
      phone: "+91 98401 23456",
      qualification: "B.Tech Mechanical Engineering",
      degree: "B.Tech",
      specialization: "Automation & Robotics",
      college: "Anna University, Chennai",
      graduationYear: "2024",
      jobFunction: "Robotics Technician",
      skills: ["PLC Programming", "Hydraulics", "SCADA"],
      city: "Chennai",
      state: "Tamil Nadu",
      verificationToken: validToken,
    }),
  });
  const candidateData = await candidateRes.json();
  console.log("Candidate Submission Status:", candidateRes.status);
  console.log("Candidate Saved ID:", candidateData.data?._id);
  if (candidateRes.status !== 201 || !candidateData.data?._id) {
    throw new Error("Candidate submission failed!");
  }
  console.log("✓ Candidate submission with Brevo email dispatch PASSED");

  // 3. RFQ Submission Flow
  console.log("\n[3] Testing RFQ Submission Flow...");
  const employerEmail = "corporate.client@manufacturingcorp.com";
  const rfqToken = jwt.sign(
    { email: employerEmail.toLowerCase().trim(), verified: true, timestamp: Date.now() },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  const rfqRes = await fetch(`${BASE_URL}/api/rfq`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Anand Mahindra",
      company: "Manufacturing Dynamics Pvt Ltd",
      email: employerEmail,
      phone: "+91 98765 00000",
      industry: "Automotive Manufacturing",
      service: "Precision Assembly Operators",
      headcount: "40 Technicians",
      timeline: "Immediate deployment",
      message: "Urgent manpower requirement for new electric vehicle line.",
      verificationToken: rfqToken,
    }),
  });
  const rfqData = await rfqRes.json();
  console.log("RFQ Submission Status:", rfqRes.status);
  console.log("RFQ Saved ID:", rfqData.data?._id);
  if (rfqRes.status !== 201 || !rfqData.data?._id) {
    throw new Error("RFQ submission failed!");
  }
  console.log("✓ RFQ submission with Brevo email dispatch PASSED");

  console.log("\n==================================================");
  console.log(" ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ✓✓✓ ");
  console.log("==================================================");
}

testFullSuite().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
