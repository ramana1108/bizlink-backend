// Using native fetch in Node.js

async function runTest() {
  console.log('--- TEST 1: Request OTP for Employer ---');
  const sendRes = await fetch('http://localhost:5000/api/email/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'operations@autoplant.com' }),
  });
  const sendData = await sendRes.json();
  console.log('Send OTP Response:', sendData);

  const testOtp = sendData.devOtp;
  if (!testOtp) {
    console.error('No devOtp received for testing');
    return;
  }

  console.log('\n--- TEST 2: Attempt RFQ without OTP verification token ---');
  const unverifiedRfqRes = await fetch('http://localhost:5000/api/rfq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Ramesh Kumar',
      company: 'AutoPlant Dynamics Pvt Ltd',
      email: 'operations@autoplant.com',
      phone: '9840112233',
      industry: 'Automotive & Auto Components',
      service: 'Bulk Assembly Workforce',
      headcount: '50 Operators',
    }),
  });
  console.log('Unverified RFQ Status (Expected 403):', unverifiedRfqRes.status);
  const unverifiedData = await unverifiedRfqRes.json();
  console.log('Unverified RFQ response:', unverifiedData);

  console.log('\n--- TEST 3: Verify OTP ---');
  const verifyRes = await fetch('http://localhost:5000/api/email/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'operations@autoplant.com',
      otp: testOtp,
    }),
  });
  const verifyData = await verifyRes.json();
  console.log('Verify OTP Response:', verifyData);
  const token = verifyData.verificationToken;

  console.log('\n--- TEST 4: Submit RFQ with Verified Token ---');
  const verifiedRfqRes = await fetch('http://localhost:5000/api/rfq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Ramesh Kumar',
      company: 'AutoPlant Dynamics Pvt Ltd',
      email: 'operations@autoplant.com',
      phone: '9840112233',
      industry: 'Automotive & Auto Components',
      service: 'Bulk Assembly Workforce',
      headcount: '50 Operators',
      verificationToken: token,
    }),
  });
  console.log('Verified RFQ Status (Expected 201):', verifiedRfqRes.status);
  const verifiedData = await verifiedRfqRes.json();
  console.log('Verified RFQ Response:', verifiedData);
}

runTest().catch(console.error);
