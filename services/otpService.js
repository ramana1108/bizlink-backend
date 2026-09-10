import crypto from "crypto";
import jwt from "jsonwebtoken";
import { getTransporter } from "./notificationService.js";

// In-memory OTP store
// Key: normalized email -> Value: { otp, expiresAt, lastSentAt, attempts }
const otpStore = new Map();

// In-memory verified tokens store for double verification
// Key: token -> Value: { email, verifiedAt }
const verifiedTokenStore = new Map();

const JWT_SECRET = process.env.JWT_SECRET || "bizlink_secure_verification_secret_key_2026";
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_ATTEMPTS = 3;

/**
 * Generates and sends a 6-digit OTP to the candidate's email
 * @param {string} email - Candidate's email
 * @returns {Promise<{success: boolean, message: string, resendAfter?: number, devOtp?: string}>}
 */
export async function sendEmailOtp(email) {
  if (!email || !email.includes("@")) {
    throw new Error("A valid email address is required");
  }

  const normalizedEmail = email.toLowerCase().trim();
  const now = Date.now();

  const existing = otpStore.get(normalizedEmail);

  // Check rate limit (60s cooldown)
  if (existing && now - existing.lastSentAt < RESEND_COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((RESEND_COOLDOWN_MS - (now - existing.lastSentAt)) / 1000);
    return {
      success: false,
      message: `Please wait ${remainingSeconds} seconds before requesting a new OTP.`,
      resendAfter: remainingSeconds,
    };
  }

  // Generate 6-digit cryptographic OTP
  const otp = crypto.randomInt(100000, 999999).toString();
  const expiresAt = now + OTP_EXPIRY_MS;

  otpStore.set(normalizedEmail, {
    otp,
    expiresAt,
    lastSentAt: now,
    attempts: 0,
  });

  // Compose Email
  const mailOptions = {
    from: `"PROFECTUS BIZLINK" <${process.env.SMTP_USER || process.env.SMTP_FROM || "career@profectusbizlink.com"}>`,
    to: normalizedEmail,
    subject: "Your Email Verification OTP - Profectus BizLink Candidate Portal",
    text: `Your Profectus BizLink verification OTP is: ${otp}. This code is valid for 10 minutes. Do not share this code with anyone.`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #DCE5F0; border-radius: 12px; overflow: hidden;">
        <div style="background: #0B1F3A; padding: 24px 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px; letter-spacing: 0.5px;">PROFECTUS BIZLINK</h1>
          <p style="color: #FBBF24; margin: 4px 0 0 0; font-size: 11px; font-weight: bold; text-transform: uppercase;">Building Workforce • Powering Industries</p>
        </div>
        <div style="padding: 30px; color: #14213D;">
          <h2 style="font-size: 18px; margin-top: 0; color: #0B1F3A;">Email Verification Code</h2>
          <p style="font-size: 14px; color: #64748B; line-height: 1.5;">
            Thank you for applying with Profectus BizLink. Please enter the following 6-digit verification code in the candidate application form:
          </p>
          <div style="background: #F6F8FC; border: 2px dashed #2563EB; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #2563EB; font-family: monospace;">${otp}</span>
          </div>
          <p style="font-size: 12px; color: #64748B; margin: 0;">
            • This OTP expires in <strong>10 minutes</strong>.<br>
            • If you did not initiate this request, you can safely disregard this email.
          </p>
        </div>
        <div style="background: #F6F8FC; padding: 14px 30px; border-top: 1px solid #DCE5F0; text-align: center; font-size: 11px; color: #94A3B8;">
          © ${new Date().getFullYear()} PROFECTUS BIZLINK (OPC) PRIVATE LIMITED • Chennai, India
        </div>
      </div>
    `,
  };

  try {
    const transport = getTransporter();
    await transport.sendMail(mailOptions);

    console.log(`[OTP Sent] Code ${otp} dispatched to ${normalizedEmail}`);

    return {
      success: true,
      message: `Verification code sent to ${normalizedEmail}`,
      resendAfter: 60,
      devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
    };
  } catch (err) {
    console.error("Failed to dispatch OTP email:", err);
    throw new Error(`Failed to send verification email: ${err.message}`);
  }
}

/**
 * Verifies the OTP submitted by the candidate
 * @param {string} email - Candidate's email
 * @param {string} submittedOtp - Candidate's entered OTP
 * @returns {{success: boolean, message: string, verificationToken?: string}}
 */
export function verifyEmailOtp(email, submittedOtp) {
  if (!email || !submittedOtp) {
    return {
      success: false,
      message: "Email and OTP code are required",
    };
  }

  const normalizedEmail = email.toLowerCase().trim();
  const entry = otpStore.get(normalizedEmail);

  if (!entry) {
    return {
      success: false,
      message: "No active verification code found for this email. Please request a new OTP.",
    };
  }

  const now = Date.now();

  // Check expiration
  if (now > entry.expiresAt) {
    otpStore.delete(normalizedEmail);
    return {
      success: false,
      message: "Verification code has expired (validity is 10 minutes). Please request a new OTP.",
    };
  }

  // Check attempt limit
  if (entry.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(normalizedEmail);
    return {
      success: false,
      message: "Maximum verification attempts exceeded. Please request a new verification code.",
    };
  }

  // Compare OTP
  if (entry.otp !== submittedOtp.toString().trim()) {
    entry.attempts += 1;
    const remainingAttempts = MAX_ATTEMPTS - entry.attempts;
    return {
      success: false,
      message: `Invalid verification code. ${remainingAttempts} attempt(s) remaining.`,
    };
  }

  // OTP is valid!
  otpStore.delete(normalizedEmail);

  // Generate cryptographically signed verification token
  const verificationToken = jwt.sign(
    {
      email: normalizedEmail,
      verified: true,
      timestamp: now,
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  verifiedTokenStore.set(verificationToken, {
    email: normalizedEmail,
    verifiedAt: now,
  });

  return {
    success: true,
    message: "Email verified successfully",
    verificationToken,
  };
}

/**
 * Validates a verification token against a given email (Backend Security Enforcement)
 * @param {string} email - Candidate's submitted email
 * @param {string} token - Candidate's verification token
 * @returns {boolean}
 */
export function validateEmailVerificationToken(email, token) {
  if (!email || !token) {
    return false;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const normalizedEmail = email.toLowerCase().trim();

    if (decoded && decoded.email === normalizedEmail && decoded.verified === true) {
      return true;
    }
  } catch (err) {
    console.warn("Verification token validation failed:", err.message);
  }

  return false;
}
