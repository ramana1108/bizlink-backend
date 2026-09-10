

async function testBackend() {
  console.log("1. Testing Health Check...");
  const healthRes = await fetch("http://localhost:5000/");
  const health = await healthRes.json();
  console.log("Health Check:", health);

  console.log("\n2. Testing Send OTP...");
  const otpRes = await fetch("http://localhost:5000/api/email/send-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test.candidate@example.com" }),
  });
  const otpData = await otpRes.json();
  console.log("Send OTP Response:", otpData);

  const testOtp = otpData.devOtp;
  console.log(`Received Dev OTP: ${testOtp}`);

  console.log("\n3. Testing Verify OTP...");
  const verifyRes = await fetch("http://localhost:5000/api/email/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test.candidate@example.com", otp: testOtp }),
  });
  const verifyData = await verifyRes.json();
  console.log("Verify OTP Response:", verifyData);

  console.log("\n4. Testing Unverified Candidate Submission (Security Check)...");
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

  console.log("\n5. Testing Verified Candidate Submission...");
  const verifiedCandidateRes = await fetch("http://localhost:5000/api/candidates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Ramesh Kumar",
      qualification: "B.E.",
      degree: "Bachelor of Engineering",
      specialization: "Mechanical Engineering",
      college: "Government College of Technology",
      graduationYear: "2025",
      email: "test.candidate@example.com",
      phone: "9876543210",
      skills: ["CNC", "AutoCAD", "Quality Inspection", "5S"],
      totalExperience: "Fresher",
      city: "Coimbatore",
      state: "Tamil Nadu",
      verificationToken: verifyData.verificationToken,
    }),
  });
  console.log("Verified Candidate Submission Status (Expect 201):", verifiedCandidateRes.status);
  const verifiedCandidateData = await verifiedCandidateRes.json();
  console.log("Verified Candidate Response:", verifiedCandidateData);

  console.log("\nALL BACKEND API TESTS COMPLETED SUCCESSFULLY!");
}

testBackend().catch(console.error);
