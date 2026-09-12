import dotenv from "dotenv";
dotenv.config({ path: "./.env" });
import { sendEmailViaBrevo } from "../services/emailService.js";

async function testLiveBrevo() {
  const recipientEmail =
    process.argv[2] ||
    process.env.MAIL_TO ||
    "career@profectusbizlink.com";

  console.log("==================================================");
  console.log(" TESTING LIVE BREVO HTTPS TRANSACTIONAL EMAIL ");
  console.log("==================================================");
  console.log(`Recipient:    ${recipientEmail}`);
  console.log(
    `Sender Email: ${
      process.env.BREVO_SENDER_EMAIL ||
      process.env.EMAIL_USER ||
      "career@profectusbizlink.com"
    }`
  );
  console.log(
    `API Key:      ${
      process.env.BREVO_API_KEY
        ? process.env.BREVO_API_KEY.substring(0, 12) + "..."
        : "NOT SET (Running in dev console mode)"
    }`
  );
  console.log("--------------------------------------------------");

  try {
    const result = await sendEmailViaBrevo({
      to: recipientEmail,
      subject: "Profectus BizLink - Live Email Delivery Test",
      text: "This is a live test email from Profectus BizLink to verify Brevo HTTPS API email delivery.",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; max-width: 500px;">
          <h2 style="color: #0B1F3A; margin: 0 0 8px 0;">PROFECTUS BIZLINK</h2>
          <p style="color: #2563EB; font-weight: bold; margin: 0 0 16px 0;">Brevo Live Email Test</p>
          <p style="color: #334155; line-height: 1.5;">This email confirms that your Brevo Transactional Email API is active and successfully delivering emails to inboxes!</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
          <p style="color: #64748B; font-size: 12px; margin: 0;">Sent at: ${new Date().toLocaleString()}</p>
        </div>
      `,
    });

    if (result.devMode) {
      console.log(
        "\n⚠️ ATTENTION: Email was NOT sent to the real inbox because BREVO_API_KEY is not set in backend/.env!"
      );
      console.log(
        "To send real emails to inboxes, add your Brevo API key to backend/.env:"
      );
      console.log("BREVO_API_KEY=xkeysib-your_actual_key_here\n");
    } else {
      console.log(
        "\n✓ SUCCESS: Live email was accepted by Brevo and sent to recipient inbox!"
      );
      console.log(`Brevo Message ID: ${result.messageId}`);
    }
  } catch (err) {
    console.error("\n✗ FAILED: Brevo returned an error:", err.message);
  }
}

testLiveBrevo();
