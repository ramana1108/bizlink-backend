import "dotenv/config";
import nodemailer from "nodemailer";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
let smtpTransporter;

function getSmtpTransporter() {
  if (!smtpTransporter) {
    const port = Number(process.env.SMTP_PORT || 465);
    smtpTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      auth: {
        user: process.env.SMTP_USER || process.env.EMAIL_USER,
        pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
      },
    });
  }

  return smtpTransporter;
}

/**
 * Checks if the provided API key is a dummy placeholder or not configured.
 */
function isDevApiKey(apiKey) {
  if (!apiKey) return true;
  const key = apiKey.trim().toLowerCase();
  return (
    key === "" ||
    key.startsWith("your_") ||
    key.includes("your_") ||
    key.includes("your-") ||
    key.includes("actual") ||
    key.includes("placeholder") ||
    key.includes("example") ||
    key === "xkeysib-your_brevo_api_key_here" ||
    key.length < 30
  );
}

/**
 * Normalizes a recipient string or object into Brevo's { email, name } format.
 * Supports:
 * - "user@example.com"
 * - "John Doe <user@example.com>"
 * - { email: "user@example.com", name: "John Doe" }
 */
function normalizeRecipient(recipient) {
  if (!recipient) return null;

  if (typeof recipient === "string") {
    const trimmed = recipient.trim();
    const match = trimmed.match(/^(?:(.*?)<)?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?$/);
    if (match) {
      const name = (match[1] || "").trim().replace(/^["']|["']$/g, "");
      const email = match[2].trim();
      return name ? { email, name } : { email };
    }
    return { email: trimmed };
  }

  if (typeof recipient === "object" && recipient.email) {
    const result = { email: recipient.email.trim() };
    if (recipient.name) {
      result.name = recipient.name.trim();
    }
    return result;
  }

  return null;
}

/**
 * Normalizes attachments into Brevo's { name, content (base64) } format.
 * Supports Buffer, base64 string, or data URI.
 */
function normalizeAttachment(att) {
  if (!att) return null;

  const name = att.name || att.filename || "attachment.pdf";
  let content = "";

  if (Buffer.isBuffer(att.content)) {
    content = att.content.toString("base64");
  } else if (typeof att.content === "string") {
    const commaIdx = att.content.indexOf(",");
    if (att.content.startsWith("data:") && commaIdx !== -1) {
      content = att.content.slice(commaIdx + 1);
    } else {
      content = att.content;
    }
  }

  if (!content) return null;

  return { name, content };
}

async function sendViaSmtp({ to, subject, html, text, attachments, senderName, senderEmail, replyTo }) {
  const result = await getSmtpTransporter().sendMail({
    from: { name: senderName, address: senderEmail },
    to: to.map((recipient) =>
      recipient.name
        ? { name: recipient.name, address: recipient.email }
        : recipient.email
    ),
    subject: subject || "Profectus BizLink Notification",
    text,
    html,
    attachments: attachments.map((attachment) => ({
      filename: attachment.name,
      content: Buffer.from(attachment.content, "base64"),
    })),
    replyTo: replyTo ? normalizeRecipient(replyTo)?.email : undefined,
  });

  return { success: true, messageId: result.messageId };
}

/**

    if (err.statusCode === 401 || err.statusCode === 403) {
      console.warn("[Email Service] Brevo authentication failed. Falling back to SMTP.");
      return sendViaSmtp({
        to: toList,
        subject,
        html,
        text,
        attachments: normalizedAttachments,
        senderName,
        senderEmail,
        replyTo,
      });
    }

 * Sends a transactional email using Brevo's REST API over HTTPS.
 *
 * @param {object} options
 * @param {string|object|Array} options.to - Recipient(s)
 * @param {string} options.subject - Subject line
 * @param {string} [options.html] - HTML email body
 * @param {string} [options.text] - Plain text email body
 * @param {Array} [options.attachments] - Array of attachments ({ filename/name, content: Buffer|base64 })
 * @param {object} [options.sender] - Optional custom sender { name, email }
 * @param {string|object} [options.replyTo] - Optional replyTo address
 * @returns {Promise<{ success: boolean, messageId?: string, data?: object, devMode?: boolean }>}
 */
export async function sendEmailViaBrevo({
  to,
  subject,
  html,
  text,
  attachments = [],
  sender,
  replyTo,
}) {
  const apiKey = (process.env.BREVO_API_KEY || "").trim();

  // 1. Resolve Sender
  const senderName =
    sender?.name ||
    process.env.BREVO_SENDER_NAME ||
    "Profectus BizLink";

  const senderEmail =
    sender?.email ||
    process.env.BREVO_SENDER_EMAIL ||
    process.env.EMAIL_USER ||
    process.env.SMTP_USER ||
    "career@profectusbizlink.com";

  // 2. Normalize Recipients
  const rawToList = Array.isArray(to) ? to : [to];
  const toList = rawToList
    .map(normalizeRecipient)
    .filter(Boolean);

  if (toList.length === 0) {
    throw new Error("No valid recipient email provided for email delivery.");
  }

  // 3. Normalize Attachments
  const normalizedAttachments = (attachments || [])
    .map(normalizeAttachment)
    .filter(Boolean);

  // 4. Use SMTP when Brevo is not configured or is a placeholder.
  if (isDevApiKey(apiKey)) {
    return sendViaSmtp({
      to: toList,
      subject,
      html,
      text,
      attachments: normalizedAttachments,
      senderName,
      senderEmail,
      replyTo,
    });
  }

  // 5. Construct Brevo API Payload
  const payload = {
    sender: {
      name: senderName,
      email: senderEmail,
    },
    to: toList,
    subject: subject || "Profectus BizLink Notification",
  };

  if (html) {
    payload.htmlContent = html;
  }
  if (text) {
    payload.textContent = text;
  }
  if (!html && !text) {
    payload.textContent = "Notification from Profectus BizLink.";
  }

  if (normalizedAttachments.length > 0) {
    payload.attachment = normalizedAttachments;
  }

  if (replyTo) {
    const normalizedReplyTo = normalizeRecipient(replyTo);
    if (normalizedReplyTo) {
      payload.replyTo = normalizedReplyTo;
    }
  }

  // 6. Execute HTTPS Request to Brevo API
  try {
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMessage =
        responseData.message ||
        responseData.error ||
        response.statusText ||
        "Unknown Brevo API error";
      console.error(
        `✗ [Brevo HTTPS API Error (${response.status})]: ${errorMessage}`
      );
      const error = new Error(`Brevo API delivery failed (${response.status}): ${errorMessage}`);
      error.statusCode = response.status;
      throw error;
    }

    const messageId = responseData.messageId || `brevo-${Date.now()}`;
    console.log(
      `✓ [Brevo HTTPS API Success] Delivered to ${toList.map((r) => r.email).join(", ")} | Message ID: ${messageId}`
    );

    return {
      success: true,
      messageId,
      data: responseData,
    };
  } catch (err) {
    console.error("✗ [Brevo HTTPS Request Exception]:", err.message);

    if (err.statusCode === 401 || err.statusCode === 403) {
      console.warn("[Email Service] Brevo authentication failed. Falling back to SMTP.");
      return sendViaSmtp({
        to: toList,
        subject,
        html,
        text,
        attachments: normalizedAttachments,
        senderName,
        senderEmail,
        replyTo,
      });
    }

    throw err;
  }
}

/**
 * Checks the Brevo HTTPS Email configuration on startup.
 */
export function verifyEmailService() {
  const apiKey = (process.env.BREVO_API_KEY || "").trim();
  const senderEmail =
    process.env.BREVO_SENDER_EMAIL ||
    process.env.EMAIL_USER ||
    process.env.SMTP_USER ||
    "career@profectusbizlink.com";

  if (!isDevApiKey(apiKey)) {
    console.log(
      `✓ [Email Service] Brevo HTTPS Transactional API active (Sender: ${senderEmail})`
    );
  } else {
      console.log(
        `ℹ️ [Email Service] BREVO_API_KEY is not set or is a placeholder. Using configured SMTP transport.`
      );
  }
}

// Backward-compatible exports
export const verifySmtpConnection = (cb) => {
  verifyEmailService();
  if (typeof cb === "function") cb(null, true);
};

export const verifyTitanSmtpConnection = verifySmtpConnection;
