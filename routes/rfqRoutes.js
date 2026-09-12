import express from "express";
import RFQ from "../models/RFQ.js";
import { validateEmailVerificationToken } from "../services/otpService.js";
import { notifyNewRFQ } from "../services/notificationService.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const {
      name,
      company,
      email,
      phone,
      industry,
      service,
      headcount,
      timeline,
      message,
      formType,
      verificationToken,
    } = req.body;

    if (!name || !company || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all mandatory fields: Name, Company, Email and Phone.",
      });
    }

    // 1. Independent Security Check: Verify Email OTP Token
    const isTokenValid = validateEmailVerificationToken(email, verificationToken);
    if (!isTokenValid) {
      return res.status(403).json({
        success: false,
        requiresVerification: true,
        message:
          "Email verification required. Please verify your official email address using the 6-digit OTP before submitting your workforce requirement.",
      });
    }

    console.log(`[RFQ Submission] Creating verified RFQ for ${company} (${email})`);

    // 2. Save Verified RFQ
    const rfq = new RFQ({
      name,
      company,
      email,
      phone,
      industry: industry || "",
      service: service || "",
      headcount: headcount || "",
      timeline: timeline || "",
      message: message || "",
      formType: formType || "employer",
      isEmailVerified: true,
    });

    const savedRFQ = await rfq.save();

    console.log("RFQ saved successfully:", savedRFQ._id);

    // 3. Dispatch Email Notifications with PDF via Brevo HTTPS API
    try {
      await notifyNewRFQ(savedRFQ);
    } catch (emailErr) {
      console.error("[RFQ Submission - Brevo Email Error] Email dispatch encountered an error:", emailErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Your submission has been sent successfully. Our team will contact you soon.",
      data: savedRFQ,
    });
  } catch (error) {
    console.error("RFQ submission error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit workforce requirement. Please try again.",
      error: error.message,
    });
  }
});

export default router;