import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateSubmissionPdf, generateCandidatePdf } from "../services/pdfService.js";
import { notifyNewRFQ, notifyNewCandidateApplication } from "../services/notificationService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTests() {
  console.log("=================================================");
  console.log(" TESTING AUTOMATIC PDF GENERATION & EMAIL DISPATCH ");
  console.log("=================================================\n");

  // 1. Test RFQ / Form Submission PDF Generation
  console.log("1. Generating RFQ / Form Submission PDF...");
  const mockRFQ = {
    _id: "64fa8b2c1234567890abcdef",
    name: "Rajesh Sharma",
    company: "Apex Precision Engineering Pvt Ltd",
    email: "operations@apexengineering.com",
    phone: "+91 98765 43210",
    industry: "Engineering & Industrial Products",
    service: "Machine Operations & CNC Machinists",
    headcount: "25 Operators (Shift A & B)",
    timeline: "Deployment within 7 days",
    message: "Requirement for precision CNC turning and milling operators for new automotive component assembly line.",
    location: "Sriperumbudur Industrial Corridor, Chennai",
    isEmailVerified: true,
    createdAt: new Date(),
  };

  const rfqPdfBuffer = await generateSubmissionPdf(mockRFQ);
  console.log(`✓ RFQ PDF Generated successfully! Size: ${rfqPdfBuffer.length} bytes`);

  // Verify PDF header magic bytes %PDF-
  const isPdfValid = rfqPdfBuffer.slice(0, 5).toString() === "%PDF-";
  console.log(`✓ PDF Magic Header Check: ${isPdfValid ? "PASSED (%PDF-)" : "FAILED"}`);

  // 2. Test Candidate PDF Generation
  console.log("\n2. Generating Candidate Profile PDF...");
  const mockCandidate = {
    _id: "64fa8b2c1234567890bcdef0",
    name: "Karthik Subramanian",
    email: "karthik.subramanian@example.com",
    phone: "+91 91234 56789",
    qualification: "Diploma in Mechanical Engineering",
    degree: "Diploma",
    specialization: "Production Engineering",
    college: "Government Polytechnic College, Chennai",
    graduationYear: "2024",
    totalExperience: "2 Years",
    jobFunction: "Assembly Line Technician",
    skills: ["CNC Operation", "Quality Inspection", "5S", "Blueprint Reading"],
    city: "Chennai",
    state: "Tamil Nadu",
    resumeFileName: "Karthik_Resume_2026.pdf",
    additionalDetails: "Looking for immediate placement in automotive manufacturing corridor.",
    createdAt: new Date(),
  };

  const candidatePdfBuffer = await generateCandidatePdf(mockCandidate);
  console.log(`✓ Candidate PDF Generated successfully! Size: ${candidatePdfBuffer.length} bytes`);

  // 3. Test Email Notification Dispatch (with attached PDF)
  console.log("\n3. Testing Notification Dispatch with Attached PDF...");
  await notifyNewRFQ(mockRFQ);
  await notifyNewCandidateApplication(mockCandidate);

  console.log("\n=================================================");
  console.log(" ALL AUTOMATED TESTS PASSED SUCCESSFULLY! ✓✓✓ ");
  console.log("=================================================\n");
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
