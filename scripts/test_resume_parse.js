async function testResumeParsing() {
  const sampleResumeText = `
    KIRAN KUMAR S
    Email: kiran.kumar@gmail.com
    Phone: +91 98451 23456
    Location: Salem, Tamil Nadu, India
    LinkedIn: linkedin.com/in/kirankumar-mech

    CAREER OBJECTIVE
    Dedicated Mechanical Engineering graduate seeking entry-level role in automotive manufacturing, CNC machine operations and quality inspection.

    EDUCATION
    Bachelor of Engineering in Mechanical Engineering (2026)
    Government College of Engineering, Salem
    CGPA: 8.4 / 10

    Higher Secondary Certificate (HSC) (2022)
    St. Mary's Higher Secondary School, Salem

    TECHNICAL SKILLS
    - Machining & Operations: CNC, VMC, Lathe Machine, Milling Machine, Grinding
    - Design & CAD: AutoCAD, SolidWorks
    - Quality & Management: Kaizen, 5S, Quality Inspection, Six Sigma basics
    - General: MS Excel, Data Entry

    PROJECTS & INTERNSHIPS
    Automotive Assembly Cell Internship | Precision Auto Components Pvt Ltd
    - Assisted in component sub-assembly line balancing.
    - Performed dimensional verification using Vernier caliper and micrometer.

    PERSONAL DETAILS
    Date of Birth: 15/05/2004
    Gender: Male
  `;

  // Create multipart boundary request with buffer
  const boundary = "----WebKitFormBoundary" + Math.random().toString(16).slice(2);
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="resume"; filename="Kiran_Kumar_Resume.txt"',
    "Content-Type: text/plain",
    "",
    sampleResumeText,
    `--${boundary}--`,
  ].join("\r\n");

  console.log("Sending sample resume to /api/resume/parse...");
  const response = await fetch("http://localhost:5000/api/resume/parse", {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body: Buffer.from(body),
  });

  const result = await response.json();
  console.log("Resume Parse Status:", response.status);
  console.log("Extracted Candidate JSON:\n", JSON.stringify(result, null, 2));
}

testResumeParsing().catch(console.error);
