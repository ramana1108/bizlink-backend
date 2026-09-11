import express from "express";
import { sendEmailOtp, verifyEmailOtp } from "../services/otpService.js";

const router = express.Router();

/**
 * POST /api/email/send-otp
 * Body: { email: string }
 */
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    const result = await sendEmailOtp(email);

    if (!result.success) {
      const statusCode = result.resendAfter ? 429 : 500;
      return res.status(statusCode).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Send OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to send verification email. Please try again later.",
    });
  }
});

/**
 * POST /api/email/verify-otp
 * Body: { email: string, otp: string }
 */
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Both email and 6-digit OTP code are required.",
      });
    }

    const result = verifyEmailOtp(email, otp);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to verify OTP. Please try again.",
    });
  }
});

export default router;
