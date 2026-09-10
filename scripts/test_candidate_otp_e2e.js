async function runCandidateTest() {
  console.log('--- TEST 1: Request OTP for Candidate ---');
  const sendRes = await fetch('http://localhost:5000/api/email/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'candidate.john@example.com' }),
  });
  const sendData = await sendRes.json();
  console.log('Send OTP Response:', sendData);

  const testOtp = sendData.devOtp;

  console.log('\n--- TEST 2: Attempt Candidate submission without OTP token ---');
  const unverifiedRes = await fetch('http://localhost:5000/api/candidates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'John Doe',
      email: 'candidate.john@example.com',
      phone: '9876543210',
      qualification: 'B.E. Mechanical',
    }),
  });
  console.log('Unverified Candidate Status (Expected 403):', unverifiedRes.status);

  console.log('\n--- TEST 3: Verify Candidate OTP ---');
  const verifyRes = await fetch('http://localhost:5000/api/email/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'candidate.john@example.com',
      otp: testOtp,
    }),
  });
  const verifyData = await verifyRes.json();
  console.log('Verify OTP Response:', verifyData);

  console.log('\n--- TEST 4: Submit Verified Candidate ---');
  const verifiedRes = await fetch('http://localhost:5000/api/candidates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'John Doe',
      email: 'candidate.john@example.com',
      phone: '9876543210',
      qualification: 'B.E. Mechanical',
      degree: 'B.E.',
      specialization: 'Mechanical Engineering',
      skills: ['CNC', 'AutoCAD', 'SolidWorks'],
      totalExperience: '2 Years',
      verificationToken: verifyData.verificationToken,
    }),
  });
  console.log('Verified Candidate Status (Expected 201):', verifiedRes.status);
  const verifiedData = await verifiedRes.json();
  console.log('Verified Candidate Response:', verifiedData);
}

runCandidateTest().catch(console.error);
