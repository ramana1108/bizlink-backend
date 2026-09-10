import nodemailer from "nodemailer";
import { generateSubmissionPdf, generateCandidatePdf } from "./pdfService.js";

let transporter = null;

/**
 * Returns a configured Nodemailer Transporter specifically for Titan Mail SMTP (smtp.titan.email:465)
 */
export function getTransporter() {
  if (!transporter) {
    const host = process.env.SMTP_HOST || "smtp.titan.email";
    const port = parseInt(process.env.SMTP_PORT || "465", 10);
    const secure = process.env.SMTP_SECURE === "true" || port === 465;
    const user = process.env.SMTP_USER || "career@profectusbizlink.com";
    const pass = process.env.SMTP_PASS;

    if (pass && pass !== "YOUR_TITAN_PASSWORD") {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure, // true for port 465 SSL
        auth: {
          user,
          pass,
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
      });
    } else {
      // Development console fallback when password is not yet entered in .env
      transporter = {
        sendMail: async (mailOptions) => {
          console.log("\n================ [TITAN MAIL SMTP (DEV / CONSOLE MODE)] ================");
          console.log(`From:        ${mailOptions.from}`);
          console.log(`To:          ${mailOptions.to}`);
          console.log(`Subject:     ${mailOptions.subject}`);
          console.log(`Attachments: ${mailOptions.attachments ? mailOptions.attachments.map((a) => a.filename).join(", ") : "None"}`);
          console.log(`Body:\n${mailOptions.text || mailOptions.html}`);
          console.log("========================================================================\n");
          return { messageId: `dev-titan-${Date.now()}` };
        },
        verify: async () => {
          console.log("ℹ️ [Titan Mail SMTP] SMTP_PASS not set in .env. Running in development mode.");
          return true;
        },
      };
    }
  }
  return transporter;
}

/**
 * Verifies the Titan Mail SMTP connection and logs the result to terminal
 */
export async function verifyTitanSmtpConnection() {
  try {
    const transport = getTransporter();
    if (transport && typeof transport.verify === "function") {
      await transport.verify();
      console.log(`✓ [Titan Mail SMTP] Connected & verified successfully! (Host: ${process.env.SMTP_HOST || "smtp.titan.email"}:${process.env.SMTP_PORT || "465"}, Account: ${process.env.SMTP_USER || "career@profectusbizlink.com"})`);
      return { success: true };
    }
  } catch (error) {
    console.error("\n=======================================================");
    console.error("✗ [Titan Mail SMTP Connection Warning]");
    console.error("  Error Code:   ", error.code || "UNKNOWN");
    console.error("  Error Message:", error.message);
    if (error.code === "EAUTH") {
      console.error("  -> Action Needed: Verify your Titan Mail password in backend/.env (SMTP_PASS)");
    } else if (error.code === "ECONNECTION" || error.code === "ETIMEDOUT") {
      console.error("  -> Action Needed: Check your internet connection or firewall access to smtp.titan.email:465");
    }
    console.error("=======================================================\n");
    return { success: false, error: error.message };
  }
}

/**
 * Formats a Date object as YYYY-MM-DD for unique filenames
 */
function getFormattedDate(d = new Date()) {
  try {
    return new Date(d).toISOString().split("T")[0];
  } catch {
    return "2026-09-07";
  }
}

/**
 * Notifies Titan Mail operations desk and candidate of a new application with attached PDF
 * @param {object} candidate - Saved candidate document
 */
export async function notifyNewCandidateApplication(candidate) {
  try {
    const transport = getTransporter();
    const adminEmail = process.env.MAIL_TO || process.env.OPERATIONS_EMAIL || process.env.NOTIFICATION_EMAIL || "career@profectusbizlink.com";
    const senderEmail = `"PROFECTUS BIZLINK" <${process.env.SMTP_USER || "career@profectusbizlink.com"}>`;

    // 1. Generate Candidate Profile PDF
    let pdfBuffer = null;
    try {
      pdfBuffer = await generateCandidatePdf(candidate);
    } catch (pdfErr) {
      console.error("[PDF Generation Error] Failed to generate candidate PDF:", pdfErr.message);
    }

    const candidateName = candidate.name || "Candidate";
    const sanitizedCandidateName = candidateName.replace(/[^a-zA-Z0-9]/g, "_");
    const dateStr = getFormattedDate(candidate.createdAt || new Date());
    const pdfFilename = `BIZLINK_Submission_${sanitizedCandidateName}_${dateStr}.pdf`;

    const attachments = pdfBuffer
      ? [
          {
            filename: pdfFilename,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ]
      : [];

    // 2. Notification to Operations Desk (career@profectusbizlink.com)
    const adminMailOptions = {
      from: senderEmail,
      to: adminEmail,
      subject: `New BIZLINK Website Submission - ${candidateName}`,
      text: `A new candidate application has been received via the PROFECTUS BIZLINK website. Please find the complete application details attached as a PDF.\n\nCandidate Name: ${candidate.name}\nEmail: ${candidate.email}\nPhone: ${candidate.phone}\nQualification: ${candidate.qualification || "—"}\nRole: ${candidate.jobFunction || candidate.jobTitle || "—"}\nLocation: ${candidate.city || ""}, ${candidate.state || ""}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #DCE5F0; border-radius: 8px; overflow: hidden;">
          <div style="background: #0B1F3A; padding: 20px; text-align: center;">
            <h2 style="color: #ffffff; margin: 0;">PROFECTUS BIZLINK</h2>
            <p style="color: #60A5FA; margin: 4px 0 0 0; font-size: 12px; font-weight: bold;">New Website Submission</p>
          </div>
          <div style="padding: 24px; color: #14213D;">
            <p style="font-size: 14px; margin-top: 0; line-height: 1.5;">
              A new candidate application has been received via the PROFECTUS BIZLINK website. Please find the complete application details attached as a PDF.
            </p>
            
            <p style="margin-bottom: 6px;"><strong>Submission Summary:</strong></p>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 16px 0;">
              <tr><td style="padding: 6px 0; color: #64748B; width: 35%;">Candidate Name:</td><td><strong>${candidate.name}</strong></td></tr>
              <tr><td style="padding: 6px 0; color: #64748B;">Email Address:</td><td>${candidate.email} (Verified ✓)</td></tr>
              <tr><td style="padding: 6px 0; color: #64748B;">Phone Number:</td><td>${candidate.phone}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748B;">Qualification:</td><td>${candidate.qualification || "—"}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748B;">Role / Function:</td><td>${candidate.jobFunction || candidate.jobTitle || "—"}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748B;">Total Experience:</td><td>${candidate.totalExperience || "Fresher"}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748B;">Location:</td><td>${candidate.city ? `${candidate.city}, ` : ""}${candidate.state || "—"}</td></tr>
            </table>

            <div style="background: #EFF6FF; border-left: 3px solid #2563EB; padding: 10px 14px; font-size: 12px; color: #1E40AF; margin-top: 12px; border-radius: 4px;">
              📄 <strong>Attached PDF:</strong> ${pdfFilename}
            </div>
          </div>
          <div style="background: #F6F8FC; padding: 12px 20px; font-size: 11px; color: #94A3B8; text-align: center;">
            Profectus BizLink Titan Mail Automated Dispatch
          </div>
        </div>
      `,
      attachments,
    };

    // 3. Acknowledgment to Candidate
    const candidateMailOptions = {
      from: senderEmail,
      to: candidate.email,
      subject: "Application Received - Profectus BizLink Candidate Portal",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; border: 1px solid #DCE5F0; border-radius: 8px; overflow: hidden;">
          <div style="background: #0B1F3A; padding: 20px; text-align: center;">
            <h2 style="color: #ffffff; margin: 0;">PROFECTUS BIZLINK</h2>
            <p style="color: #FBBF24; margin: 4px 0 0 0; font-size: 12px; font-weight: bold;">Application Received</p>
          </div>
          <div style="padding: 24px; color: #14213D; font-size: 14px; line-height: 1.5;">
            <p>Dear <strong>${candidate.name}</strong>,</p>
            <p>Thank you for submitting your candidate registration profile to <strong>Profectus BizLink</strong>.</p>
            <p style="color: #64748B;">
              Our recruitment operations desk is reviewing your profile and qualifications against upcoming shift openings across our partner enterprises.
            </p>
            <p style="color: #64748B;">
              Our team will reach out to you directly via phone or email for role suitability and interview coordination.
            </p>
            <div style="background: #F6F8FC; border-left: 3px solid #2563EB; padding: 12px 16px; margin: 20px 0; font-size: 12px;">
              <strong>Operations Desk:</strong> +91 78453 39972<br>
              <strong>Email:</strong> career@profectusbizlink.com
            </div>
            <p style="margin: 0; font-size: 13px;">Best regards,<br><strong>Profectus BizLink Recruitment Team</strong></p>
          </div>
        </div>
      `,
    };

    const deliveryResults = await Promise.allSettled([
      transport.sendMail(adminMailOptions),
      transport.sendMail(candidateMailOptions),
    ]);
    const deliveryErrors = deliveryResults.filter((result) => result.status === "rejected");
    if (deliveryErrors.length > 0) {
      throw new Error(deliveryErrors.map((result) => result.reason?.message || "Unknown mail delivery error").join("; "));
    }

    console.log(`✓ [Titan Mail Dispatched] Submission delivered for candidate: ${candidate.name} (${candidate.email})`);
    return { success: true };
  } catch (err) {
    console.error("✗ [Titan Mail Dispatch Error - Candidate Application]:", err);
    throw err;
  }
}

/**
 * Notifies Titan Mail operations desk and employer of a new RFQ / Form submission with attached PDF
 * @param {object} rfq - Saved RFQ document
 */
export async function notifyNewRFQ(rfq) {
  try {
    const transport = getTransporter();
    const adminEmail = process.env.MAIL_TO || process.env.OPERATIONS_EMAIL || process.env.NOTIFICATION_EMAIL || "career@profectusbizlink.com";
    const senderEmail = `"PROFECTUS BIZLINK" <${process.env.SMTP_USER || "career@profectusbizlink.com"}>`;

    // 1. Generate Corporate Form Submission PDF
    let pdfBuffer = null;
    try {
      pdfBuffer = await generateSubmissionPdf(rfq);
    } catch (pdfErr) {
      console.error("[PDF Generation Error] Failed to generate RFQ PDF:", pdfErr.message);
    }

    const displayName = rfq.company || rfq.name || "Inquiry";
    const sanitizedName = (rfq.name ? rfq.name.replace(/[^a-zA-Z0-9]/g, "_") : displayName.replace(/[^a-zA-Z0-9]/g, "_"));
    const dateStr = getFormattedDate(rfq.createdAt || new Date());
    const pdfFilename = `BIZLINK_Submission_${sanitizedName}_${dateStr}.pdf`;

    const attachments = pdfBuffer
      ? [
          {
            filename: pdfFilename,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ]
      : [];

    // 2. Notification to Bizlink Operations Desk (career@profectusbizlink.com)
    const adminMailOptions = {
      from: senderEmail,
      to: adminEmail,
      subject: `New BIZLINK Website Submission - ${displayName}`,
      text: `A new workforce requirement submission has been received via the PROFECTUS BIZLINK website. Please find the complete submission details attached as a PDF.\n\nCompany/Name: ${displayName}\nContact Person: ${rfq.name}\nEmail: ${rfq.email}\nPhone: ${rfq.phone}\nIndustry: ${rfq.industry || "—"}\nService: ${rfq.service || "—"}\nHeadcount: ${rfq.headcount || "—"}\nTimeline: ${rfq.timeline || "—"}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #DCE5F0; border-radius: 8px; overflow: hidden;">
          <div style="background: #0B1F3A; padding: 20px; text-align: center;">
            <h2 style="color: #ffffff; margin: 0;">PROFECTUS BIZLINK</h2>
            <p style="color: #F59E0B; margin: 4px 0 0 0; font-size: 12px; font-weight: bold;">New Website Submission</p>
          </div>
          <div style="padding: 24px; color: #14213D;">
            <p style="font-size: 14px; margin-top: 0; line-height: 1.5;">
              A new workforce requirement submission has been received via the PROFECTUS BIZLINK website. Please find the complete submission details attached as a PDF.
            </p>
            
            <p style="margin-bottom: 6px;"><strong>Submission Summary:</strong></p>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
              <tr><td style="padding: 6px 0; color: #64748B; width: 35%;">Company / Name:</td><td><strong>${rfq.company || rfq.name || "—"}</strong></td></tr>
              <tr><td style="padding: 6px 0; color: #64748B;">Contact Person:</td><td>${rfq.name}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748B;">Official Email:</td><td>${rfq.email} ${rfq.isEmailVerified ? "(Verified ✓)" : ""}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748B;">Contact Phone:</td><td>${rfq.phone}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748B;">Industry Sector:</td><td>${rfq.industry || "—"}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748B;">Required Role / Service:</td><td>${rfq.service || "—"}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748B;">Required Headcount:</td><td>${rfq.headcount || "—"}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748B;">Deployment Timeline:</td><td>${rfq.timeline || "—"}</td></tr>
              ${rfq.message ? `<tr><td style="padding: 6px 0; color: #64748B;">Requirement Details:</td><td>${rfq.message}</td></tr>` : ""}
            </table>

            <div style="background: #EFF6FF; border-left: 3px solid #2563EB; padding: 12px 16px; font-size: 12.5px; color: #1E40AF; border-radius: 4px;">
              📄 <strong>Attached PDF:</strong> ${pdfFilename}
            </div>
          </div>
          <div style="background: #F6F8FC; padding: 12px 20px; font-size: 11px; color: #94A3B8; text-align: center;">
            Profectus BizLink Titan Mail Automated Dispatch
          </div>
        </div>
      `,
      attachments,
    };

    // 3. Acknowledgment to Employer / Submitter with attached PDF
    const employerMailOptions = {
      from: senderEmail,
      to: rfq.email,
      subject: `Workforce Requirement Received - Profectus BizLink [${displayName}]`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; border: 1px solid #DCE5F0; border-radius: 8px; overflow: hidden;">
          <div style="background: #0B1F3A; padding: 20px; text-align: center;">
            <h2 style="color: #ffffff; margin: 0;">PROFECTUS BIZLINK</h2>
            <p style="color: #F59E0B; margin: 4px 0 0 0; font-size: 12px; font-weight: bold;">Workforce Request Acknowledged</p>
          </div>
          <div style="padding: 24px; color: #14213D; font-size: 14px; line-height: 1.5;">
            <p>Dear <strong>${rfq.name}</strong>,</p>
            <p>Thank you for submitting your workforce requirement on behalf of <strong>${displayName}</strong> to <strong>Profectus BizLink</strong>.</p>
            <p style="color: #64748B;">
              Your workforce requirement has been received successfully. Our operations team will review your specifications and contact you shortly.
            </p>
            <div style="background: #EFF6FF; border-left: 3px solid #2563EB; padding: 10px 14px; font-size: 12px; color: #1E40AF; margin: 16px 0;">
              📄 A copy of your submitted workforce inquiry record is attached to this email as a PDF.
            </div>
            <div style="background: #FFFBEB; border-left: 3px solid #F59E0B; padding: 12px 16px; margin: 20px 0; font-size: 12px;">
              <strong>Rapid Response Desk:</strong> +91 78453 39972<br>
              <strong>Official Email:</strong> career@profectusbizlink.com<br>
              <strong>Corporate Address:</strong> Chennai, Tamil Nadu, India
            </div>
            <p style="margin: 0; font-size: 13px;">Best regards,<br><strong>Profectus BizLink Industrial Solutions Team</strong></p>
          </div>
        </div>
      `,
      attachments,
    };

    const deliveryResults = await Promise.allSettled([
      transport.sendMail(adminMailOptions),
      transport.sendMail(employerMailOptions),
    ]);
    const deliveryErrors = deliveryResults.filter((result) => result.status === "rejected");
    if (deliveryErrors.length > 0) {
      throw new Error(deliveryErrors.map((result) => result.reason?.message || "Unknown mail delivery error").join("; "));
    }

    console.log(`✓ [Titan Mail Dispatched] Submission delivered for ${displayName} (${rfq.email})`);
    return { success: true };
  } catch (err) {
    console.error("✗ [Titan Mail Dispatch Error - RFQ Submission]:", err);
    throw err;
  }
}
