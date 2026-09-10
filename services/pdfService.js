import PDFDocument from "pdfkit";

/**
 * Formats a Date object to a readable string (IST format)
 * @param {Date|string} date
 * @returns {string}
 */
function formatSubmissionDate(date = new Date()) {
  try {
    const d = new Date(date);
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }) + " (IST)";
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Draws a section header with an accent color bar
 */
function drawSectionHeader(doc, title, y) {
  doc.rect(40, y, 4, 16).fill("#2563EB");
  doc.rect(46, y, 524, 16).fill("#F1F5F9");
  doc.fontSize(10).font("Helvetica-Bold").fillColor("#0B1F3A").text(title.toUpperCase(), 54, y + 4);
  return y + 24;
}

/**
 * Draws a two-column key-value row inside a table/card
 */
function drawKeyValueRow(doc, label, value, y, isAlternate = false) {
  const rowHeight = 20;
  if (isAlternate) {
    doc.rect(40, y, 530, rowHeight).fill("#F8FAFC");
  }
  
  // Label
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#475569").text(label, 48, y + 5, { width: 160 });
  
  // Value
  doc.fontSize(9).font("Helvetica").fillColor("#0B1F3A").text(value || "—", 210, y + 5, { width: 350 });
  
  // Subtle separator line
  doc.moveTo(40, y + rowHeight).lineTo(570, y + rowHeight).lineWidth(0.5).strokeColor("#E2E8F0").stroke();
  
  return y + rowHeight;
}

/**
 * Generates a corporate PDF document buffer for an RFQ / Employer Form Submission
 * @param {object} submission - Form submission data / RFQ model instance
 * @returns {Promise<Buffer>} - Resolves to PDF Buffer
 */
export function generateSubmissionPdf(submission) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        info: {
          Title: `BIZLINK Form Submission - ${submission.company || submission.name || "Inquiry"}`,
          Author: "PROFECTUS BIZLINK",
          Subject: "Workforce Solutions Form Submission Record",
          Keywords: "BizLink, Workforce, Manpower, RFQ, Form Submission",
        },
      });

      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const submissionDate = formatSubmissionDate(submission.createdAt || new Date());
      const referenceId = submission._id ? String(submission._id).toUpperCase() : `BZL-${Date.now().toString(36).toUpperCase()}`;

      // =========================================================================
      // 1. TOP HEADER BANNER (Navy #0B1F3A with Amber Accent)
      // =========================================================================
      doc.rect(0, 0, 595.28, 90).fill("#0B1F3A");
      
      // Top accent strip
      doc.rect(0, 0, 595.28, 4).fill("#F59E0B");

      // Company Brand Name & Tagline
      doc.fontSize(18).font("Helvetica-Bold").fillColor("#FFFFFF").text("PROFECTUS BIZLINK", 40, 22);
      doc.fontSize(8.5).font("Helvetica").fillColor("#94A3B8").text("Workforce Solutions  •  Multi-Industry  •  People Driven", 40, 44);

      // Submission Type Badge on Top Right
      doc.roundedRect(380, 20, 175, 48, 4).fill("#142B4D");
      doc.rect(380, 20, 4, 48).fill("#F59E0B");
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#F59E0B").text("OFFICIAL SUBMISSION RECORD", 392, 28);
      doc.fontSize(7.5).font("Helvetica").fillColor("#CBD5E1").text(`Ref: #${referenceId.slice(-10)}`, 392, 42);
      doc.fontSize(7).font("Helvetica").fillColor("#94A3B8").text(new Date().toLocaleDateString("en-IN"), 392, 54);

      // =========================================================================
      // 2. DOCUMENT SUMMARY BAR
      // =========================================================================
      let curY = 105;
      
      doc.rect(40, curY, 530, 36).fill("#EFF6FF");
      doc.rect(40, curY, 530, 36).lineWidth(1).strokeColor("#BFDBFE").stroke();
      
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#1E3A8A").text("WORKFORCE REQUIREMENT & RFQ SUBMISSION", 52, curY + 8);
      doc.fontSize(8).font("Helvetica").fillColor("#64748B").text(`Submitted On: ${submissionDate}`, 52, curY + 22);

      curY += 50;

      // =========================================================================
      // 3. SECTION 1: ORGANIZATION & CONTACT DETAILS
      // =========================================================================
      curY = drawSectionHeader(doc, "1. Organization & Contact Information", curY);

      curY = drawKeyValueRow(doc, "Company Name:", submission.company || "Individual / Not Specified", curY, false);
      curY = drawKeyValueRow(doc, "Contact Person:", submission.name || "—", curY, true);
      curY = drawKeyValueRow(doc, "Official Email Address:", submission.email ? `${submission.email} ${submission.isEmailVerified ? "(Verified ✓)" : ""}` : "—", curY, false);
      curY = drawKeyValueRow(doc, "Contact Phone Number:", submission.phone || "—", curY, true);
      if (submission.location) {
        curY = drawKeyValueRow(doc, "Location / Facility:", submission.location, curY, false);
      }

      curY += 12;

      // =========================================================================
      // 4. SECTION 2: WORKFORCE REQUIREMENT SPECIFICATIONS
      // =========================================================================
      curY = drawSectionHeader(doc, "2. Requirement Specifications", curY);

      curY = drawKeyValueRow(doc, "Industry Sector:", submission.industry || "General Industry", curY, false);
      curY = drawKeyValueRow(doc, "Required Role / Service:", submission.service || submission.requiredRole || "Workforce Deployment", curY, true);
      curY = drawKeyValueRow(doc, "Estimated Headcount:", submission.headcount || "As per project scope", curY, false);
      curY = drawKeyValueRow(doc, "Target Timeline:", submission.timeline || "Immediate / Flexible", curY, true);
      curY = drawKeyValueRow(doc, "Form Submission Type:", (submission.formType || "Employer RFQ").toUpperCase(), curY, false);

      curY += 12;

      // =========================================================================
      // 5. SECTION 3: ADDITIONAL REQUIREMENTS / MESSAGE
      // =========================================================================
      curY = drawSectionHeader(doc, "3. Detailed Requirements & Project Notes", curY);

      const messageContent = submission.message || submission.details || submission.additionalDetails || "No additional specific instructions provided in the form submission.";
      
      const messageBoxHeight = Math.max(60, Math.min(130, doc.heightOfString(messageContent, { width: 500, fontSize: 8.5 }) + 20));
      
      doc.rect(40, curY, 530, messageBoxHeight).fill("#F8FAFC");
      doc.rect(40, curY, 530, messageBoxHeight).lineWidth(0.5).strokeColor("#E2E8F0").stroke();
      
      doc.fontSize(8.5).font("Helvetica").fillColor("#334155").text(messageContent, 52, curY + 10, {
        width: 506,
        lineGap: 3,
      });

      curY += messageBoxHeight + 20;

      // =========================================================================
      // 6. BOTTOM METADATA & VERIFICATION STATUS
      // =========================================================================
      doc.roundedRect(40, curY, 530, 42, 4).fill("#F1F5F9");
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#0B1F3A").text("System Processing Status", 52, curY + 8);
      doc.fontSize(7.5).font("Helvetica").fillColor("#64748B").text(`Database ID: ${referenceId}  |  Email Verified: ${submission.isEmailVerified ? "YES" : "NO"}  |  Generated by BIZLINK Automated Dispatch`, 52, curY + 22);

      // =========================================================================
      // 7. FOOTER (Bottom of A4 page: Y ~ 780-842)
      // =========================================================================
      const footerY = 780;
      doc.moveTo(40, footerY).lineTo(555, footerY).lineWidth(0.5).strokeColor("#CBD5E1").stroke();
      
      doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#0B1F3A").text("PROFECTUS BIZLINK (OPC) PRIVATE LIMITED", 40, footerY + 8);
      doc.fontSize(7).font("Helvetica").fillColor("#64748B").text("Workforce & Manpower Solutions  •  Chennai, Tamil Nadu, India", 40, footerY + 18);
      doc.fontSize(7).font("Helvetica").fillColor("#2563EB").text("career@profectusbizlink.com  |  +91 78453 39972  |  www.profectusbizlink.com", 40, footerY + 28);
      
      doc.fontSize(6.5).font("Helvetica-Oblique").fillColor("#94A3B8").text("Confidentiality Notice: This document contains proprietary workforce inquiries intended solely for Profectus BizLink Operations.", 40, footerY + 40);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generates a corporate PDF document buffer for Candidate Registration submissions
 * @param {object} candidate - Candidate model instance
 * @returns {Promise<Buffer>} - Resolves to PDF Buffer
 */
export function generateCandidatePdf(candidate) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        info: {
          Title: `BIZLINK Candidate Application - ${candidate.name || "Candidate"}`,
          Author: "PROFECTUS BIZLINK",
          Subject: "Candidate Registration Profile Record",
        },
      });

      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const submissionDate = formatSubmissionDate(candidate.createdAt || new Date());
      const referenceId = candidate._id ? String(candidate._id).toUpperCase() : `CAND-${Date.now().toString(36).toUpperCase()}`;

      // Header Banner
      doc.rect(0, 0, 595.28, 90).fill("#0B1F3A");
      doc.rect(0, 0, 595.28, 4).fill("#2563EB");

      doc.fontSize(18).font("Helvetica-Bold").fillColor("#FFFFFF").text("PROFECTUS BIZLINK", 40, 22);
      doc.fontSize(8.5).font("Helvetica").fillColor("#94A3B8").text("Candidate Registration & Talent Portal", 40, 44);

      doc.roundedRect(380, 20, 175, 48, 4).fill("#142B4D");
      doc.rect(380, 20, 4, 48).fill("#2563EB");
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#60A5FA").text("CANDIDATE APPLICATION", 392, 28);
      doc.fontSize(7.5).font("Helvetica").fillColor("#CBD5E1").text(`Ref: #${referenceId.slice(-10)}`, 392, 42);
      doc.fontSize(7).font("Helvetica").fillColor("#94A3B8").text(new Date().toLocaleDateString("en-IN"), 392, 54);

      let curY = 105;
      doc.rect(40, curY, 530, 36).fill("#EFF6FF");
      doc.rect(40, curY, 530, 36).lineWidth(1).strokeColor("#BFDBFE").stroke();
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#1E3A8A").text("VERIFIED CANDIDATE REGISTRATION PROFILE", 52, curY + 8);
      doc.fontSize(8).font("Helvetica").fillColor("#64748B").text(`Submitted On: ${submissionDate}`, 52, curY + 22);

      curY += 50;

      // Section 1: Personal & Contact
      curY = drawSectionHeader(doc, "1. Candidate Information", curY);
      curY = drawKeyValueRow(doc, "Full Name:", candidate.name || "—", curY, false);
      curY = drawKeyValueRow(doc, "Email Address:", `${candidate.email || "—"} (Verified ✓)`, curY, true);
      curY = drawKeyValueRow(doc, "Phone Number:", candidate.phone || "—", curY, false);
      curY = drawKeyValueRow(doc, "Location:", `${candidate.city || ""} ${candidate.state ? `, ${candidate.state}` : ""} ${candidate.country || "India"}`.trim() || "—", curY, true);

      curY += 12;

      // Section 2: Education & Professional Qualifications
      curY = drawSectionHeader(doc, "2. Education & Professional Background", curY);
      curY = drawKeyValueRow(doc, "Primary Qualification:", candidate.qualification || "—", curY, false);
      curY = drawKeyValueRow(doc, "Degree / Specialization:", `${candidate.degree || ""} ${candidate.specialization ? `(${candidate.specialization})` : ""}`.trim() || "—", curY, true);
      curY = drawKeyValueRow(doc, "College / Passing Year:", `${candidate.college || ""} ${candidate.graduationYear ? `[${candidate.graduationYear}]` : ""}`.trim() || "—", curY, false);
      curY = drawKeyValueRow(doc, "Total Experience / Role:", `${candidate.totalExperience || "Fresher"} / ${candidate.jobFunction || candidate.jobTitle || "—"}`, curY, true);
      curY = drawKeyValueRow(doc, "Key Skills:", Array.isArray(candidate.skills) && candidate.skills.length > 0 ? candidate.skills.join(", ") : (candidate.skills || "—"), curY, false);

      curY += 12;

      // Section 3: Notes & Attached Resume
      curY = drawSectionHeader(doc, "3. Resume & Additional Details", curY);
      curY = drawKeyValueRow(doc, "Attached Resume File:", candidate.resumeFileName || (candidate.resumeParsed ? "Parsed via AI Engine" : "Direct Web Registration"), curY, false);
      if (candidate.additionalDetails) {
        curY = drawKeyValueRow(doc, "Candidate Notes:", candidate.additionalDetails, curY, true);
      }

      // Footer
      const footerY = 780;
      doc.moveTo(40, footerY).lineTo(555, footerY).lineWidth(0.5).strokeColor("#CBD5E1").stroke();
      doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#0B1F3A").text("PROFECTUS BIZLINK (OPC) PRIVATE LIMITED", 40, footerY + 8);
      doc.fontSize(7).font("Helvetica").fillColor("#64748B").text("Workforce & Manpower Solutions  •  Chennai, Tamil Nadu, India", 40, footerY + 18);
      doc.fontSize(7).font("Helvetica").fillColor("#2563EB").text("career@profectusbizlink.com  |  +91 78453 39972", 40, footerY + 28);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
