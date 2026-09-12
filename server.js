import "dotenv/config";
import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import rfqRoutes from "./routes/rfqRoutes.js";
import candidateRoutes from "./routes/candidateRoutes.js";
import resumeRoutes from "./routes/resumeRoutes.js";
import emailRoutes from "./routes/emailRoutes.js";
import { verifyEmailService } from "./services/emailService.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
connectDB();

// Verify Brevo HTTPS Email API Configuration on startup
verifyEmailService();

// API Routes
app.use("/api/rfq", rfqRoutes);
app.use("/api/contact", rfqRoutes);
app.use("/api/candidates", candidateRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api/email", emailRoutes);

// Health check / Welcome route
app.get("/", (req, res) => {
  res.json({
    message: "PROFECTUS BIZLINK Backend API is running with Brevo HTTPS Email API!",
    endpoints: {
      rfq: "/api/rfq",
      candidates: "/api/candidates",
      resumeParser: "/api/resume/parse",
      sendOtp: "/api/email/send-otp",
      verifyOtp: "/api/email/verify-otp",
    },
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
