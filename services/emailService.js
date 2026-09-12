import "dotenv/config";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

/**
 * Checks if the provided API key is missing or an invalid placeholder.
 */
export function isInvalidApiKey(apiKey) {
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
    key.length < 20
  );
}

/**
 * Normalizes a recipient into Brevo's [{ email, name }] format.
 */
function normalizeRecipient(recipient) {
  if (!recipient) return null;

  if (typeof recipient === "string") {
    const trimmed = recipient.trim();
    const match = trimmed.match(/^(?:(.*?)<)?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?$/);
    if (match) {
      const name = (match[1] || "").trim().replace(/^["']|["']$/g, "");
      const email = match[2].trim().toLowerCase();
      return name ? { email, name } : { email };
    }
    return { email: trimmed.toLowerCase() };
  }

  if (typeof recipient === "object" && recipient.email) {
    const result = { email: recipient.email.trim().toLowerCase() };
    if (recipient.name) {
      result.name = recipient.name.trim();
    }
    return result;
  }

  return null;
}

/**
 * Normalizes attachments into Brevo's [{ name, content (base64) }] format.
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

/**
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
  const apiKey = (process.env.BREVO_API_KEY || "").trim().replace(/^["']|["']$/g, "");

  // 1. Resolve Sender
  const senderName =
    sender?.name ||
    process.env.BREVO_SENDER_NAME ||
    "Profectus BizLink";

  const senderEmail = (
    sender?.email ||
    process.env.BREVO_SENDER_EMAIL ||
    process.env.EMAIL_USER ||
    process.env.SMTP_USER ||
    "career@profectusbizlink.com"
  ).trim().replace(/^["']|["']$/g, "");

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

  // 4. Handle Missing / Placeholder API Key
  if (isInvalidApiKey(apiKey)) {
    if (process.env.NODE_ENV === "production") {
      console.error("[Email Service Error] BREVO_API_KEY is missing or invalid in production environment.");
      throw new Error("BREVO_API_KEY is missing or invalid in production environment.");
    }

    // Local Development Fallback
    console.log("\n================ [BREVO DEV / CONSOLE MODE] ================");
    console.log(`Sender:      ${senderName} <${senderEmail}>`);
    console.log(`To:          ${toList.map((r) => (r.name ? `${r.name} <${r.email}>` : r.email)).join(", ")}`);
    console.log(`Subject:     ${subject}`);
    console.log(
      `Attachments: ${
        normalizedAttachments.length > 0
          ? normalizedAttachments.map((a) => `${a.name} (${Math.round((a.content.length * 3) / 4)} bytes)`).join(", ")
          : "None"
      }`
    );
    console.log(`Body:\n${text || "(HTML content provided)"}`);
    console.log("============================================================\n");

    return {
      success: true,
      messageId: `dev-brevo-${Date.now()}`,
      devMode: true,
    };
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

    const responseText = await response.text();
    let responseData = {};
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { message: responseText };
    }

    if (!response.ok) {
      console.error(`[Brevo API Error] HTTP ${response.status} ${response.statusText}`);
      console.error(`[Brevo API Error Details]:`, responseText);

      const errorMessage =
        responseData.message ||
        responseData.error ||
        `HTTP ${response.status} ${response.statusText}`;
      
      throw new Error(`Brevo API delivery failed (${response.status}): ${errorMessage}`);
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
    console.error("[Brevo HTTPS Request Exception]:", err.message);
    throw err;
  }
}

/**
 * Checks Brevo account connectivity, API key validity, and verified senders.
 */
export async function checkBrevoAccountStatus() {
  const apiKey = (process.env.BREVO_API_KEY || "").trim().replace(/^["']|["']$/g, "");
  const senderEmail = (
    process.env.BREVO_SENDER_EMAIL ||
    process.env.EMAIL_USER ||
    process.env.SMTP_USER ||
    "career@profectusbizlink.com"
  ).trim().replace(/^["']|["']$/g, "");

  if (isInvalidApiKey(apiKey)) {
    return {
      configured: false,
      status: "MISSING_OR_PLACEHOLDER_KEY",
      message: "BREVO_API_KEY is not set or is a placeholder in the backend environment.",
      senderEmail,
    };
  }

  try {
    // 1. Check account authentication
    const accountRes = await fetch("https://api.brevo.com/v3/account", {
      headers: { "api-key": apiKey, accept: "application/json" },
    });
    const accountData = await accountRes.json().catch(() => ({}));

    if (!accountRes.ok) {
      return {
        configured: false,
        status: "AUTHENTICATION_FAILED",
        httpStatus: accountRes.status,
        message: accountData.message || "Invalid Brevo API Key",
        senderEmail,
      };
    }

    // 2. Check verified senders
    const sendersRes = await fetch("https://api.brevo.com/v3/senders", {
      headers: { "api-key": apiKey, accept: "application/json" },
    });
    const sendersData = await sendersRes.json().catch(() => ({}));
    const sendersList = Array.isArray(sendersData.senders) ? sendersData.senders : [];

    const isSenderVerified = sendersList.some(
      (s) => s.email?.toLowerCase() === senderEmail.toLowerCase() && s.active === true
    );

    return {
      configured: true,
      status: "AUTHENTICATED",
      accountEmail: accountData.email,
      companyName: accountData.companyName,
      senderEmail,
      isSenderVerified,
      verifiedSenders: sendersList.map((s) => ({ email: s.email, name: s.name, active: s.active })),
      notice: isSenderVerified
        ? "Sender email is active and verified in Brevo."
        : `ATTENTION: Sender email '${senderEmail}' is not yet verified under Brevo -> Senders & IP -> Senders.`,
    };
  } catch (err) {
    return {
      configured: false,
      status: "ERROR",
      message: err.message,
      senderEmail,
    };
  }
}

/**
 * Checks the Brevo HTTPS Email configuration on startup.
 */
export function verifyEmailService() {
  const apiKey = (process.env.BREVO_API_KEY || "").trim().replace(/^["']|["']$/g, "");

  if (!isInvalidApiKey(apiKey)) {
    console.log("[Email Service] Brevo API configured");
  } else {
    console.warn("[Email Service] BREVO_API_KEY is missing");
  }
}

// Backward-compatible exports
export const verifySmtpConnection = (cb) => {
  verifyEmailService();
  if (typeof cb === "function") cb(null, true);
};

export const verifyTitanSmtpConnection = verifySmtpConnection;
