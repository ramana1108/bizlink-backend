import express from "express";
import Candidate from "../models/Candidate.js";
import { validateEmailVerificationToken } from "../services/otpService.js";
import { notifyNewCandidateApplication } from "../services/notificationService.js";

const router = express.Router();

const ALLOWED_RESUME_EXTS = ["pdf", "doc", "docx", "txt"];
const MAX_RESUME_SIZE = 5 * 1024 * 1024; // 5 MB

function validateAndSanitizeAttachment(attachment, fallbackName = "") {
  if (!attachment || !attachment.content) return null;

  const rawName = attachment.name || fallbackName || "Resume.pdf";
  const sanitizedName = rawName.replace(/[^a-zA-Z0-9._\- ]/g, "_").trim() || "Resume.pdf";
  const ext = sanitizedName.split(".").pop().toLowerCase();

  if (!ALLOWED_RESUME_EXTS.includes(ext)) {
    console.warn(`[Attachment Validation] Ignored attachment with unsupported extension: .${ext}`);
    return null;
  }

  // If content is base64 string, estimate size
  if (typeof attachment.content === "string") {
    const base64Data = attachment.content.includes(",")
      ? attachment.content.split(",")[1]
      : attachment.content;
    const approximateBytes = (base64Data.length * 3) / 4;
    if (approximateBytes > MAX_RESUME_SIZE + 2048) {
      console.warn(`[Attachment Validation] Ignored attachment exceeding 5MB limit (${Math.round(approximateBytes)} bytes)`);
      return null;
    }
  }

  return {
    name: sanitizedName,
    content: attachment.content,
  };
}

async function handleCandidateSubmission(req, res) {
  try {
    const {
      name,
      qualification,
      degree,
      specialization,
      college,
      graduationYear,
      phone,
      email,
      industry,
      jobFunction,
      skills,
      totalExperience,
      company,
      jobTitle,
      city,
      state,
      country,
      dateOfBirth,
      gender,
      certifications,
      linkedin,
      github,
      additionalDetails,
      resumeFileName,
      resumeParsed,
      resumeAttachment,
      verificationToken,
    } = req.body;

    console.log("========== CANDIDATE APPLICATION RECEIVED ==========");
    console.log(`Candidate: ${name}, Email: ${email}, Phone: ${phone}`);

    // Validate uploaded resume attachment if present
    const validatedResumeAttachment = validateAndSanitizeAttachment(
      resumeAttachment,
      resumeFileName
    );

    if (validatedResumeAttachment) {
      console.log(`[Candidate Submission] Validated resume attachment: ${validatedResumeAttachment.name}`);
    }

    // 1. Basic Required Fields Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Full name is required.",
      });
    }

    if (!email || !email.includes("@")) {
      return res.status(400).json({
        success: false,
        message: "A valid email address is required.",
      });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({
        success: false,
        message: "Contact phone number is required.",
      });
    }

    // 2. CRITICAL SECURITY ENFORCEMENT: Independent Backend Email Verification Check
    const isVerified = validateEmailVerificationToken(email, verificationToken);

    if (!isVerified) {
      console.warn(`[Security Alert] Candidate submission rejected for unverified email: ${email}`);
      return res.status(403).json({
        success: false,
        message:
          "Email verification failed or the verification token is invalid. Please verify your email with the OTP code before submitting.",
        requiresVerification: true,
      });
    }

    // 3. Format & Sanitize Candidate Data
    const candidateData = {
      name: name.trim(),
      qualification: qualification ? qualification.trim() : (degree || "Not Specified"),
      degree: degree ? degree.trim() : "",
      specialization: specialization ? specialization.trim() : "",
      college: college ? college.trim() : "",
      graduationYear: graduationYear ? graduationYear.trim() : "",
      phone: phone.trim(),
      email: email.toLowerCase().trim(),
      industry: industry ? industry.trim() : "",
      jobFunction: jobFunction ? jobFunction.trim() : "",
      skills: Array.isArray(skills) ? skills : (typeof skills === "string" ? skills.split(",").map(s => s.trim()).filter(Boolean) : []),
      totalExperience: totalExperience ? totalExperience.trim() : "",
      company: company ? company.trim() : "",
      jobTitle: jobTitle ? jobTitle.trim() : "",
      city: city ? city.trim() : "",
      state: state ? state.trim() : "",
      country: country ? country.trim() : "India",
      dateOfBirth: dateOfBirth ? dateOfBirth.trim() : "",
      gender: gender ? gender.trim() : "",
      certifications: certifications ? certifications.trim() : "",
      linkedin: linkedin ? linkedin.trim() : "",
      github: github ? github.trim() : "",
      additionalDetails: additionalDetails ? additionalDetails.trim() : "",
      resumeFileName: validatedResumeAttachment?.name || (resumeFileName ? resumeFileName.trim() : ""),
      resumeParsed: Boolean(resumeParsed),
      isEmailVerified: true,
    };

    // 4. Save to Database
    const candidate = new Candidate(candidateData);
    const savedCandidate = await candidate.save();

    console.log("========== CANDIDATE SAVED SUCCESSFULLY ==========");
    console.log(`Database ID: ${savedCandidate._id}`);

    // 5. Send Notification Alert with PDF and Uploaded Resume to Merchant & Candidate via Brevo HTTPS API
    try {
      await notifyNewCandidateApplication(savedCandidate, validatedResumeAttachment);
    } catch (emailErr) {
      console.error("[Candidate Submission - Brevo Email Error] Email dispatch encountered an error:", emailErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Your submission has been sent successfully. Our team will contact you soon.",
      data: savedCandidate,
    });
  } catch (error) {
    console.error("========== CANDIDATE SAVE ERROR ==========", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit candidate application: " + error.message,
    });
  }
}

// Support both POST / and POST /apply
router.post("/", handleCandidateSubmission);
router.post("/apply", handleCandidateSubmission);

export default router;