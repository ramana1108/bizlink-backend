import fs from "fs/promises";

async function testHttpPdfUpload() {
  const buf = await fs.readFile("../frontend/company_profile.pdf");
  const boundary = "----WebKitFormBoundary" + Math.random().toString(16).slice(2);

  const header = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="resume"; filename="candidate_profile.pdf"\r\n` +
    `Content-Type: application/pdf\r\n\r\n`
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, buf, footer]);

  console.log("Sending PDF file to http://localhost:5000/api/resume/parse...");
  const res = await fetch("http://localhost:5000/api/resume/parse", {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  console.log("HTTP Status Code:", res.status);
  const data = await res.json();
  console.log("Extracted Result:\n", JSON.stringify(data, null, 2));
}

testHttpPdfUpload().catch(console.error);
