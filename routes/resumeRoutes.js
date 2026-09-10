import express from "express";
import multer from "multer";
import { extractTextFromResume, parseResumeText } from "../services/resumeParserService.js";

const router = express.Router();

// Configure in-memory multer upload (Zero permanent disk storage of unneeded files)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
    ];

    const ext = file.originalname.split(".").pop().toLowerCase();
    const allowedExts = ["pdf", "docx", "doc", "txt"];

    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file format. Please upload a resume in PDF, DOC or DOCX format (Max 5MB)."
        )
      );
    }
  },
});

/**
 * POST /api/resume/parse
 * Accepts multipart/form-data with 'resume' file field
 */
router.post("/parse", (req, res, next) => {
  upload.single("resume")(req, res, async (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "File size exceeds the 5 MB limit. Please upload a smaller resume file.",
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || "Failed to process resume file upload.",
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No resume file provided. Please select a PDF or DOCX resume.",
        });
      }

      console.log(`[Resume Upload] Processing ${req.file.originalname} (${req.file.size} bytes)`);

      // 1. Extract raw text from file buffer
      const extractedText = await extractTextFromResume(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname
      );

      if (!extractedText || extractedText.trim().length === 0) {
        return res.status(422).json({
          success: false,
          message:
            "Could not extract readable text from the uploaded resume. Please check if the file is scanned/image-only or fill in the details manually.",
        });
      }

      // 2. Parse text into structured candidate JSON
      const parsedData = parseResumeText(extractedText, req.file.originalname);

      parsedData.resumeFileName = req.file.originalname;

      console.log(`[Resume Parsed] Success for candidate: ${parsedData.fullName || "Identified Candidate"}`);

      return res.status(200).json({
        success: true,
        message: "Resume details extracted successfully. Please review and verify the details before submitting.",
        data: parsedData,
      });
    } catch (error) {
      console.error("Resume parse error:", error);
      return res.status(500).json({
        success: false,
        message: `Failed to analyze resume: ${error.message}. You can still fill out the form manually.`,
      });
    }
  });
});

export default router;
