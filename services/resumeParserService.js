import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

/**
 * Extracts plain text from an uploaded file buffer based on mimetype / filename
 * @param {Buffer} buffer - File buffer in memory
 * @param {string} mimetype - File mimetype
 * @param {string} originalname - Original file name
 * @returns {Promise<string>} - Extracted text content
 */
export async function extractTextFromResume(buffer, mimetype, originalname = "") {
  const ext = originalname.split(".").pop().toLowerCase();

  try {
    // 1. PDF File
    if (mimetype === "application/pdf" || ext === "pdf") {
      try {
        if (typeof PDFParse === "function") {
          const parser = new PDFParse({ data: buffer });
          await parser.load();
          const res = await parser.getText();
          if (res) {
            if (typeof res === "string" && res.trim().length > 0) {
              return res;
            }
            if (res.text && typeof res.text === "string" && res.text.trim().length > 0) {
              return res.text;
            }
            if (Array.isArray(res.pages)) {
              const joinedPages = res.pages.map((p) => p.text || "").join("\n");
              if (joinedPages.trim().length > 0) return joinedPages;
            }
          }
        }
      } catch (pdfErr) {
        console.warn("Primary PDFParse extraction error:", pdfErr.message);
      }

      // Secondary PDF buffer text stream extraction fallback
      try {
        const rawString = buffer.toString("latin1");
        // Extract stream objects or uncompressed text tokens
        const streamMatches = rawString.match(/\(([^()]{2,100})\)\s*Tj/g);
        if (streamMatches && streamMatches.length > 5) {
          const streamText = streamMatches
            .map((m) => m.replace(/^\(|\)\s*Tj$/g, ""))
            .join(" ");
          if (streamText.length > 50) {
            return streamText;
          }
        }
      } catch {
        // continue
      }

      // If we got here and PDFParse exists, try one more time or throw descriptive error
      try {
        const parser = new PDFParse({ data: buffer });
        await parser.load();
        const res = await parser.getText();
        return res?.text || (typeof res === "string" ? res : "");
      } catch (finalErr) {
        throw new Error(`PDF text extraction error: ${finalErr.message}`);
      }
    }

    // 2. DOCX / Word File
    if (
      mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      ext === "docx"
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || "";
    }

    // 3. Plain Text / Fallback
    if (mimetype === "text/plain" || ext === "txt") {
      return buffer.toString("utf-8");
    }

    // Attempt mammoth as general word extractor fallback
    try {
      const result = await mammoth.extractRawText({ buffer });
      if (result.value && result.value.trim().length > 0) {
        return result.value;
      }
    } catch {
      // ignore
    }

    return buffer.toString("utf-8");
  } catch (error) {
    console.error("Text extraction failed:", error);
    throw new Error(`Failed to extract text from ${originalname}: ${error.message}`);
  }
}

/**
 * NLP and Pattern Extraction Engine for Resumes
 * @param {string} text - Raw resume text
 * @param {string} originalname - Original file name for fallback hints
 * @returns {object} - Structured JSON with candidate information
 */
export function parseResumeText(text, originalname = "") {
  if (!text || typeof text !== "string") {
    return getEmptyCandidateJson();
  }

  const cleanText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = cleanText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // 1. Email Extraction
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
  const emailMatch = cleanText.match(emailRegex);
  const email = emailMatch ? emailMatch[1].toLowerCase().trim() : "";

  // 2. Phone Extraction (Indian 10-digit mobile, with optional +91, 0, or spaces/dashes)
  const phoneRegex = /(?:(?:\+?91|0)?[\s-]?)?([6-9]\d{4}[\s-]?\d{5}|[6-9]\d{9})/g;
  let phone = "";
  const phoneMatches = cleanText.match(phoneRegex);
  if (phoneMatches && phoneMatches.length > 0) {
    const rawPhone = phoneMatches[0].replace(/[\s-+]/g, "");
    phone = rawPhone.length > 10 ? rawPhone.slice(-10) : rawPhone;
  }

  // 3. Name Extraction
  // Look at the top 8 lines of resume for full name (skipping generic headings)
  const ignoredNameKeywords = [
    "resume",
    "curriculum",
    "vitae",
    "cv",
    "profile",
    "biodata",
    "contact",
    "personal",
    "details",
    "email",
    "phone",
    "page",
    "career",
    "objective",
    "summary",
    "experience",
    "education",
    "skills",
    "projects",
  ];

  let fullName = "";
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Check if line is not an email, phone, or generic keyword, and is between 3 to 40 chars
    if (
      !emailRegex.test(line) &&
      !phoneRegex.test(line) &&
      !ignoredNameKeywords.some((kw) => lower.includes(kw)) &&
      /^[a-zA-Z\s.]{3,40}$/.test(line) &&
      line.split(/\s+/).length >= 1 &&
      line.split(/\s+/).length <= 5
    ) {
      fullName = line;
      break;
    }
  }

  // Fallback name search from explicit labels e.g., "Name: John Doe"
  if (!fullName) {
    const explicitNameMatch = cleanText.match(/(?:Name|Full\s*Name)\s*[:\-]\s*([a-zA-Z\s.]{3,35})/i);
    if (explicitNameMatch) {
      fullName = explicitNameMatch[1].trim();
    }
  }

  // Fallback: derive name from filename if not identified
  if (!fullName && originalname) {
    const baseName = originalname
      .replace(/\.(pdf|docx|doc|txt)$/i, "")
      .replace(/[-_]/g, " ")
      .replace(/\b(resume|cv|biodata|profile|final|updated|it|cse|ece|mech|eee)\b/gi, "")
      .trim();
    if (baseName.length >= 3 && /^[a-zA-Z\s.]+$/.test(baseName)) {
      fullName = baseName;
    }
  }

  // 4. Degree and Highest Qualification Extraction
  const qualifications = [
    { pattern: /\b(B\.?E\.?|Bachelor\s+of\s+Engineering)\b/i, label: "B.E." },
    { pattern: /\b(B\.?Tech\.?|Bachelor\s+of\s+Technology)\b/i, label: "B.Tech" },
    { pattern: /\b(M\.?E\.?|Master\s+of\s+Engineering)\b/i, label: "M.E." },
    { pattern: /\b(M\.?Tech\.?|Master\s+of\s+Technology)\b/i, label: "M.Tech" },
    { pattern: /\b(Diploma\s+in\s+[a-zA-Z\s]+|Diploma)\b/i, label: "Diploma" },
    { pattern: /\b(ITI\s+in\s+[a-zA-Z\s]+|ITI|I\.T\.I)\b/i, label: "ITI" },
    { pattern: /\b(B\.?Sc\.?|Bachelor\s+of\s+Science)\b/i, label: "B.Sc" },
    { pattern: /\b(M\.?Sc\.?|Master\s+of\s+Science)\b/i, label: "M.Sc" },
    { pattern: /\b(MBA|M\.B\.A|Master\s+of\s+Business\s+Administration)\b/i, label: "MBA" },
    { pattern: /\b(B\.?Com\.?|Bachelor\s+of\s+Commerce)\b/i, label: "B.Com" },
    { pattern: /\b(BCA|B\.C\.A)\b/i, label: "BCA" },
    { pattern: /\b(MCA|M\.C\.A)\b/i, label: "MCA" },
    { pattern: /\b(HSC|12th\s+Standard|12th|Higher\s+Secondary)\b/i, label: "12th Standard" },
    { pattern: /\b(SSLC|10th\s+Standard|10th|Secondary\s+School)\b/i, label: "10th Standard" },
  ];

  let highestQualification = "";
  let degree = "";
  for (const q of qualifications) {
    if (q.pattern.test(cleanText)) {
      highestQualification = q.label;
      degree = q.label;
      break;
    }
  }

  // 5. Specialization / Department Extraction
  const specializations = [
    { pattern: /\b(Information\s+Technology|I\.T\.|IT)\b/i, label: "Information Technology" },
    { pattern: /\b(Computer\s+Science\s+(?:and|&)\s+Engineering|Computer\s+Science|CSE)\b/i, label: "Computer Science and Engineering" },
    { pattern: /\b(Mechanical\s+Engineering|Mechanical)\b/i, label: "Mechanical Engineering" },
    { pattern: /\b(Electronics\s+(?:and|&)\s+Communication\s+Engineering|ECE)\b/i, label: "Electronics and Communication Engineering" },
    { pattern: /\b(Electrical\s+(?:and|&)\s+Electronics\s+Engineering|EEE)\b/i, label: "Electrical and Electronics Engineering" },
    { pattern: /\b(Automobile\s+Engineering|Automobile|Automotive)\b/i, label: "Automobile Engineering" },
    { pattern: /\b(Mechatronics\s+Engineering|Mechatronics)\b/i, label: "Mechatronics Engineering" },
    { pattern: /\b(Civil\s+Engineering|Civil)\b/i, label: "Civil Engineering" },
    { pattern: /\b(Production\s+Engineering|Manufacturing\s+Engineering)\b/i, label: "Production Engineering" },
    { pattern: /\b(Machinist|Tool\s+(?:and|&)\s+Die\s+Making|Fitter|Turner|Welder|Electrician)\b/i, label: "Machining & Technical Trades" },
    { pattern: /\b(Plastic\s+Technology|Polymer\s+Engineering)\b/i, label: "Plastic Technology" },
    { pattern: /\b(Food\s+Technology|Food\s+Processing)\b/i, label: "Food Technology" },
    { pattern: /\b(Textile\s+Technology|Fashion\s+Technology)\b/i, label: "Textile Technology" },
  ];

  let specialization = "";
  for (const s of specializations) {
    if (s.pattern.test(cleanText)) {
      specialization = s.label;
      break;
    }
  }

  // 6. College / University Extraction
  let college = "";
  const collegeMatch = cleanText.match(
    /(?:at|from|in)?\s*([A-Za-z\s.,'-]+(?:College|Institute|University|Polytechnic|Academy|Vidya\s*Mandir|School\s+of\s+Engineering)[A-Za-z\s.,'-]*)/i
  );
  if (collegeMatch) {
    let rawCollege = collegeMatch[1].split("\n")[0].trim().replace(/^[\s,.-]+|[\s,.-]+$/g, "");
    if (rawCollege.length >= 6 && rawCollege.length <= 80) {
      college = rawCollege;
    }
  }

  // 7. Graduation Year Extraction
  let graduationYear = "";
  const gradYearMatch = cleanText.match(/\b(20[0-2][0-9]|19[89][0-9])\b/g);
  if (gradYearMatch && gradYearMatch.length > 0) {
    const validYears = gradYearMatch.filter((y) => {
      const num = parseInt(y, 10);
      return num >= 2010 && num <= 2030;
    });
    if (validYears.length > 0) {
      graduationYear = validYears[validYears.length - 1];
    }
  }

  // 8. Skills Extraction
  const knownSkills = [
    "JavaScript",
    "TypeScript",
    "React",
    "Node.js",
    "Express.js",
    "HTML",
    "CSS",
    "Tailwind",
    "Python",
    "Java",
    "C++",
    "C",
    "SQL",
    "MySQL",
    "PostgreSQL",
    "MongoDB",
    "Git",
    "GitHub",
    "AWS",
    "Docker",
    "Linux",
    "REST API",
    "CNC",
    "VMC",
    "HMC",
    "PLC",
    "SCADA",
    "AutoCAD",
    "SolidWorks",
    "Catia",
    "Soldering",
    "PCB Assembly",
    "Quality Inspection",
    "Kaizen",
    "5S",
    "Six Sigma",
    "Total Quality Management",
    "TQM",
    "Lathe Machine",
    "Milling Machine",
    "Grinding",
    "Welding",
    "TIG Welding",
    "MIG Welding",
    "Fitting",
    "Electrical Maintenance",
    "Mechanical Maintenance",
    "Injection Moulding",
    "Pneumatics",
    "Hydraulics",
    "Inventory Management",
    "Warehouse Management",
    "Forklift Operation",
    "MS Excel",
    "Data Entry",
  ];

  const extractedSkills = [];
  for (const skill of knownSkills) {
    const skillRegex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (skillRegex.test(cleanText)) {
      extractedSkills.push(skill);
    }
  }

  // 9. Work Experience / Total Experience
  let totalExperience = "";
  let company = "";
  let jobTitle = "";

  if (/\b(fresher|fresh\s+graduate|entry\s+level|no\s+experience)\b/i.test(cleanText)) {
    totalExperience = "Fresher";
  } else {
    const expMatch = cleanText.match(/(\d+(?:\.\d+)?\+?)\s*(?:years?|yrs?)(?:\s+of)?\s+experience/i);
    if (expMatch) {
      totalExperience = `${expMatch[1]} Years`;
    }
  }

  // Job Title match
  const jobTitles = [
    "Full Stack Developer",
    "Software Engineer",
    "Web Developer",
    "Frontend Developer",
    "Backend Developer",
    "Assembly Operator",
    "Production Operator",
    "CNC Operator",
    "VMC Operator",
    "Quality Inspector",
    "Line Quality Checker",
    "Maintenance Technician",
    "Mechanical Engineer",
    "Electrical Engineer",
    "Production Engineer",
    "Quality Engineer",
    "Stores Assistant",
    "Warehouse Associate",
    "Picker / Packer",
    "Machine Operator",
    "Fitter",
    "Welder",
    "Trainee",
  ];

  for (const title of jobTitles) {
    const titleRegex = new RegExp(`\\b${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (titleRegex.test(cleanText)) {
      jobTitle = title;
      break;
    }
  }

  // Company Match
  const companyMatch = cleanText.match(
    /(?:at|in|with|for)\s+([A-Z][A-Za-z0-9\s&.,'-]+(?:Pvt\.?\s*Ltd\.?|Private\s+Limited|Ltd\.?|Limited|Corporation|Enterprises|Technologies|Industries|Manufacturing|Solutions))/i
  );
  if (companyMatch) {
    company = companyMatch[1].trim().replace(/^[\s,.-]+|[\s,.-]+$/g, "");
  }

  // 10. City, State, Country Extraction
  let city = "";
  let state = "";
  const cities = [
    "Chennai",
    "Coimbatore",
    "Salem",
    "Hosur",
    "Tirupur",
    "Madurai",
    "Trichy",
    "Tiruchirappalli",
    "Erode",
    "Ranipet",
    "Vellore",
    "Kanchipuram",
    "Chengalpattu",
    "Sriperumbudur",
    "Oragadam",
    "Bangalore",
    "Bengaluru",
    "Hyderabad",
    "Mumbai",
    "Pune",
  ];

  for (const c of cities) {
    if (new RegExp(`\\b${c}\\b`, "i").test(cleanText)) {
      city = c;
      break;
    }
  }

  if (/\b(Tamil\s*Nadu|TN)\b/i.test(cleanText)) {
    state = "Tamil Nadu";
  } else if (/\b(Karnataka)\b/i.test(cleanText)) {
    state = "Karnataka";
  } else if (/\b(Andhra\s*Pradesh)\b/i.test(cleanText)) {
    state = "Andhra Pradesh";
  }

  // 11. Links (LinkedIn, GitHub)
  const linkedinMatch = cleanText.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i);
  const linkedin = linkedinMatch ? `https://linkedin.com/in/${linkedinMatch[1]}` : "";

  const githubMatch = cleanText.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)/i);
  const github = githubMatch ? `https://github.com/${githubMatch[1]}` : "";

  // 12. Date of Birth & Gender (only if available)
  let dateOfBirth = "";
  const dobMatch = cleanText.match(/(?:DOB|Date\s*of\s*Birth|Birth\s*Date)\s*[:\-]\s*([0-9]{1,2}[-\/.][0-9]{1,2}[-\/.][0-9]{2,4})/i);
  if (dobMatch) {
    dateOfBirth = dobMatch[1].trim();
  }

  let gender = "";
  const genderMatch = cleanText.match(/(?:Gender|Sex)\s*[:\-]\s*(Male|Female|Other)/i);
  if (genderMatch) {
    gender = genderMatch[1].trim();
  }

  // 13. Industry Mapping based on skills or degree
  let industry = "";
  if (specialization.includes("Automobile") || /automotive|auto\s+parts|oem/i.test(cleanText)) {
    industry = "Automotive & Auto Components";
  } else if (specialization.includes("Electronics") || /smt|pcb|soldering|electronics/i.test(cleanText)) {
    industry = "Electronics & Electrical";
  } else if (specialization.includes("Mechanical") || /cnc|vmc|machining|lathe/i.test(cleanText)) {
    industry = "Engineering & Industrial Products";
  } else if (specialization.includes("Textile") || /garment|textile|weaving/i.test(cleanText)) {
    industry = "Textiles & Garments";
  } else if (specialization.includes("Food") || /food\s+grade|hygiene|packaging/i.test(cleanText)) {
    industry = "Food Processing";
  } else if (specialization.includes("Plastic") || /moulding|injection|polymer/i.test(cleanText)) {
    industry = "Plastic / Injection Moulding";
  } else if (/warehouse|logistics|inventory|3pl|dispatch/i.test(cleanText)) {
    industry = "Warehouse & 3PL Operations";
  }

  return {
    fullName,
    email,
    phone,
    highestQualification,
    degree,
    specialization,
    college,
    graduationYear,
    skills: extractedSkills,
    experience: totalExperience || "Fresher",
    totalExperience,
    company,
    jobTitle,
    city,
    state,
    country: "India",
    dateOfBirth,
    gender,
    certifications: "",
    linkedin,
    github,
    industry,
    jobFunction: jobTitle || specialization || highestQualification,
  };
}

function getEmptyCandidateJson() {
  return {
    fullName: "",
    email: "",
    phone: "",
    highestQualification: "",
    degree: "",
    specialization: "",
    college: "",
    graduationYear: "",
    skills: [],
    experience: "",
    totalExperience: "",
    company: "",
    jobTitle: "",
    city: "",
    state: "",
    country: "India",
    dateOfBirth: "",
    gender: "",
    certifications: "",
    linkedin: "",
    github: "",
    industry: "",
    jobFunction: "",
  };
}
