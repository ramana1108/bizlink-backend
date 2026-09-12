import "dotenv/config";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { sendEmailViaBrevo } from "./emailService.js";

// ============================================================
// IN-MEMORY OTP STORE
// Key: normalized email
// Value: { otp, expiresAt, lastSentAt, attempts }
// ============================================================
const otpStore = new Map();

// ============================================================
// VERIFIED TOKEN STORE
// Key: verification token
// Value: { email, verifiedAt }
// ============================================================
const verifiedTokenStore = new Map();

// ============================================================
// CONFIGURATION
// ============================================================
const JWT_SECRET =
  process.env.JWT_SECRET ||
  "bizlink_secure_verification_secret_key_2026";

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_ATTEMPTS = 3;

// ============================================================
// SEND EMAIL OTP
// POST /api/email/send-otp
//
// Generates a secure 6-digit OTP and sends it to the exact
// email address entered by the candidate via Brevo HTTPS API.
// ============================================================
export async function sendEmailOtp(email) {
  // ----------------------------------------------------------
  // Validate email
  // ----------------------------------------------------------
  if (!email || typeof email !== "string" || !email.includes("@")) {
    throw new Error("A valid email address is required");
  }

  // Normalize email
  const normalizedEmail = email.toLowerCase().trim();

  const now = Date.now();

  // ----------------------------------------------------------
  // Check whether an OTP was already sent recently
  // ----------------------------------------------------------
  const existing = otpStore.get(normalizedEmail);

  if (
    existing &&
    now - existing.lastSentAt < RESEND_COOLDOWN_MS
  ) {
    const remainingSeconds = Math.ceil(
      (RESEND_COOLDOWN_MS -
        (now - existing.lastSentAt)) /
        1000
    );

    return {
      success: false,
      message: `Please wait ${remainingSeconds} seconds before requesting a new OTP.`,
      resendAfter: remainingSeconds,
    };
  }

  // ----------------------------------------------------------
  // Generate secure 6-digit OTP
  // ----------------------------------------------------------
  const otp = crypto.randomInt(100000, 1000000).toString();

  const expiresAt = now + OTP_EXPIRY_MS;

  // ----------------------------------------------------------
  // Store OTP temporarily
  // ----------------------------------------------------------
  otpStore.set(normalizedEmail, {
    otp,
    expiresAt,
    lastSentAt: now,
    attempts: 0,
  });

  // ----------------------------------------------------------
  // Compose OTP email
  // ----------------------------------------------------------
  const mailPayload = {
    // Sends the OTP to the candidate's entered email.
    to: normalizedEmail,

    subject: "Your Email Verification OTP - Profectus BizLink Candidate Portal",

    // Plain-text version
    text: `
Your Profectus BizLink verification OTP is: ${otp}

This code is valid for 10 minutes.

Do not share this code with anyone.

If you did not request this verification code, you can safely ignore this email.
    `.trim(),

    // HTML version
    html: `
      <div
        style="
          font-family:
            'Segoe UI',
            Tahoma,
            Geneva,
            Verdana,
            sans-serif;
          max-width: 540px;
          margin: 0 auto;
          background: #ffffff;
          border: 1px solid #DCE5F0;
          border-radius: 12px;
          overflow: hidden;
        "
      >

        <!-- HEADER -->
        <div
          style="
            background: #0B1F3A;
            padding: 24px 30px;
            text-align: center;
          "
        >
          <h1
            style="
              color: #ffffff;
              margin: 0;
              font-size: 20px;
              letter-spacing: 0.5px;
            "
          >
            PROFECTUS BIZLINK
          </h1>

          <p
            style="
              color: #FBBF24;
              margin: 4px 0 0 0;
              font-size: 11px;
              font-weight: bold;
              text-transform: uppercase;
            "
          >
            Building Workforce • Powering Industries
          </p>
        </div>

        <!-- BODY -->
        <div
          style="
            padding: 30px;
            color: #14213D;
          "
        >

          <h2
            style="
              font-size: 18px;
              margin-top: 0;
              color: #0B1F3A;
            "
          >
            Email Verification Code
          </h2>

          <p
            style="
              font-size: 14px;
              color: #64748B;
              line-height: 1.5;
            "
          >
            Thank you for applying with
            Profectus BizLink.
            Please enter the following 6-digit
            verification code in the candidate
            application form.
          </p>

          <!-- OTP BOX -->
          <div
            style="
              background: #F6F8FC;
              border: 2px dashed #2563EB;
              border-radius: 8px;
              padding: 18px;
              text-align: center;
              margin: 24px 0;
            "
          >
            <span
              style="
                font-size: 32px;
                font-weight: 800;
                letter-spacing: 6px;
                color: #2563EB;
                font-family: monospace;
              "
            >
              ${otp}
            </span>
          </div>

          <p
            style="
              font-size: 12px;
              color: #64748B;
              margin: 0;
            "
          >
            • This OTP expires in
            <strong>10 minutes</strong>.
            <br />

            • Do not share this code with anyone.
            <br />

            • If you did not initiate this request,
            you can safely disregard this email.
          </p>

        </div>

        <!-- FOOTER -->
        <div
          style="
            background: #F6F8FC;
            padding: 14px 30px;
            border-top: 1px solid #DCE5F0;
            text-align: center;
            font-size: 11px;
            color: #94A3B8;
          "
        >
          © ${new Date().getFullYear()}
          PROFECTUS BIZLINK (OPC) PRIVATE LIMITED
          • Chennai, India
        </div>

      </div>
    `,
  };

  // ----------------------------------------------------------
  // SEND EMAIL THROUGH BREVO HTTPS API
  // ----------------------------------------------------------
  try {
    console.log(`[OTP] Sending verification email to: ${normalizedEmail}`);

    const result = await sendEmailViaBrevo(mailPayload);

    console.log(`[OTP] Email dispatched successfully. ID: ${result?.messageId || "N/A"}`);

    return {
      success: true,
      message: `Verification code sent to ${normalizedEmail}`,
      resendAfter: 60,
    };
  } catch (err) {
    console.error(`[OTP] Failed to send verification email to ${normalizedEmail}:`, err.message);

    // Remove stored OTP if email sending failed so user can immediately retry
    otpStore.delete(normalizedEmail);

    return {
      success: false,
      message: "Unable to send verification email. Please try again later.",
    };
  }
}

// ============================================================
// VERIFY EMAIL OTP
// POST /api/email/verify-otp
//
// Candidate provides:
// {
//   email: "candidate@example.com",
//   otp: "123456"
// }
//
// The backend checks the OTP stored for that email.
// ============================================================
export function verifyEmailOtp(email, submittedOtp) {
  // ----------------------------------------------------------
  // Validate input
  // ----------------------------------------------------------
  if (!email || !submittedOtp) {
    return {
      success: false,
      message: "Email and OTP code are required",
    };
  }

  // Normalize email
  const normalizedEmail = email.toLowerCase().trim();

  // Normalize OTP
  const normalizedOtp = submittedOtp.toString().trim();

  // ----------------------------------------------------------
  // Validate OTP format
  // ----------------------------------------------------------
  if (!/^\d{6}$/.test(normalizedOtp)) {
    return {
      success: false,
      message: "Please enter a valid 6-digit OTP.",
    };
  }

  // ----------------------------------------------------------
  // Find OTP for this email
  // ----------------------------------------------------------
  const entry = otpStore.get(normalizedEmail);

  if (!entry) {
    return {
      success: false,
      message:
        "No active verification code found for this email. Please request a new OTP.",
    };
  }

  const now = Date.now();

  // ----------------------------------------------------------
  // Check OTP expiration
  // ----------------------------------------------------------
  if (now > entry.expiresAt) {
    otpStore.delete(normalizedEmail);

    return {
      success: false,
      message:
        "Verification code has expired (validity is 10 minutes). Please request a new OTP.",
    };
  }

  // ----------------------------------------------------------
  // Check maximum attempts
  // ----------------------------------------------------------
  if (entry.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(normalizedEmail);

    return {
      success: false,
      message:
        "Maximum verification attempts exceeded. Please request a new verification code.",
    };
  }

  // ----------------------------------------------------------
  // Compare submitted OTP
  // ----------------------------------------------------------
  if (entry.otp !== normalizedOtp) {
    entry.attempts += 1;

    const remainingAttempts =
      MAX_ATTEMPTS - entry.attempts;

    return {
      success: false,
      message: `Invalid verification code. ${remainingAttempts} attempt(s) remaining.`,
    };
  }

  // ----------------------------------------------------------
  // OTP is correct
  // ----------------------------------------------------------
  otpStore.delete(normalizedEmail);

  // ----------------------------------------------------------
  // Generate signed verification token
  // ----------------------------------------------------------
  const verificationToken = jwt.sign(
    {
      email: normalizedEmail,
      verified: true,
      timestamp: now,
    },
    JWT_SECRET,
    {
      expiresIn: "1h",
    }
  );

  // Store verification token
  verifiedTokenStore.set(verificationToken, {
    email: normalizedEmail,
    verifiedAt: now,
  });

  console.log(
    `[OTP Verified] Email successfully verified: ${normalizedEmail}`
  );

  return {
    success: true,
    message: "Email verified successfully",
    verificationToken,
  };
}

// ============================================================
// VALIDATE EMAIL VERIFICATION TOKEN
//
// Used by other backend routes to ensure the candidate's
// email was actually verified before accepting the form.
// ============================================================
export function validateEmailVerificationToken(
  email,
  token
) {
  if (!email || !token) {
    return false;
  }

  try {
    // Verify JWT
    const decoded = jwt.verify(
      token,
      JWT_SECRET
    );

    const normalizedEmail =
      email.toLowerCase().trim();

    // Make sure the token belongs to the same email
    if (
      decoded &&
      decoded.email === normalizedEmail &&
      decoded.verified === true
    ) {
      return true;
    }
  } catch (err) {
    console.warn(
      "Verification token validation failed:",
      err.message
    );
  }

  return false;
}

// ============================================================
// OPTIONAL CLEANUP
//
// Removes expired OTPs and old verification tokens from memory.
// This helps prevent the in-memory stores from growing forever.
// ============================================================
setInterval(() => {
  const now = Date.now();

  // ----------------------------------------------------------
  // Remove expired OTPs
  // ----------------------------------------------------------
  for (const [email, entry] of otpStore.entries()) {
    if (now > entry.expiresAt) {
      otpStore.delete(email);
    }
  }

  // ----------------------------------------------------------
  // Remove expired JWT verification tokens
  // JWT expiration is 1 hour, so remove tokens older than 1h.
  // ----------------------------------------------------------
  const TOKEN_EXPIRY_MS = 60 * 60 * 1000;

  for (const [token, entry] of verifiedTokenStore.entries()) {
    if (now - entry.verifiedAt > TOKEN_EXPIRY_MS) {
      verifiedTokenStore.delete(token);
    }
  }
}, 5 * 60 * 1000).unref(); // Run cleanup every 5 minutes (unref so process can exit cleanly)