/**
 * Cloudflare Worker - Document Scanner API
 * Provides image scanning/OCR functionality for arroyo-cv-builder GitHub Pages site
 *
 * Endpoints:
 * POST /api/scan - Upload image and extract structured data
 * GET /api/health - Health check
 */

import { OpenAI } from "openai";

interface Env {
  GEMINI_API_KEY: string;
  GEMINI_BASE_URL: string;
}

interface ScanResult {
  success: boolean;
  data?: ExtractedData;
  error?: string;
  processingTime?: number;
}

interface ExtractedData {
  // Personal info
  fullName?: string;
  email?: string;
  phone?: string;
  address?: string;
  linkedin?: string;
  github?: string;
  website?: string;

  // Professional summary
  summary?: string;

  // Experience
  experience?: Experience[];

  // Education
  education?: Education[];

  // Skills
  skills?: string[];

  // Projects
  projects?: Project[];

  // Certifications
  certifications?: Certification[];

  // Languages
  languages?: Language[];

  // Raw extracted text (for debugging)
  rawText?: string;
}

interface Experience {
  title?: string;
  company?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  description?: string[];
}

interface Education {
  degree?: string;
  institution?: string;
  location?: string;
  graduationDate?: string;
  gpa?: string;
}

interface Project {
  name?: string;
  description?: string;
  technologies?: string[];
  link?: string;
}

interface Certification {
  name?: string;
  issuer?: string;
  date?: string;
  expiryDate?: string;
}

interface Language {
  name?: string;
  proficiency?: string;
}

// System prompt for document extraction
const SYSTEM_PROMPT = `You are a document extraction engine specialized in CVs/Resumes. Extract ALL information from the uploaded document image and return it as structured JSON.

EXTRACTION RULES:
1. Read the document top-to-bottom, left-to-right
2. Extract ALL text content, preserving structure
3. For CVs/Resumes, identify and categorize:
   - Personal info (name, contact, links)
   - Professional summary
   - Work experience (with dates, descriptions)
   - Education (degrees, institutions, dates)
   - Skills (technical, soft, languages)
   - Projects
   - Certifications
   - Languages
4. Return ONLY valid JSON matching the schema below
5. If a field is not found, use null (not empty string)
6. Keep dates in original format
7. For experience descriptions, split into bullet points

JSON SCHEMA:
{
  "fullName": "string|null",
  "email": "string|null",
  "phone": "string|null",
  "address": "string|null",
  "linkedin": "string|null",
  "github": "string|null",
  "website": "string|null",
  "summary": "string|null",
  "experience": [
    {
      "title": "string|null",
      "company": "string|null",
      "location": "string|null",
      "startDate": "string|null",
      "endDate": "string|null",
      "current": "boolean",
      "description": "string[]"
    }
  ],
  "education": [
    {
      "degree": "string|null",
      "institution": "string|null",
      "location": "string|null",
      "graduationDate": "string|null",
      "gpa": "string|null"
    }
  ],
  "skills": "string[]",
  "projects": [
    {
      "name": "string|null",
      "description": "string|null",
      "technologies": "string[]",
      "link": "string|null"
    }
  ],
  "certifications": [
    {
      "name": "string|null",
      "issuer": "string|null",
      "date": "string|null",
      "expiryDate": "string|null"
    }
  ],
  "languages": [
    {
      "name": "string|null",
      "proficiency": "string|null"
    }
  ],
  "rawText": "string"
}`;

const USER_PROMPT = `Extract all information from this CV/Resume image. Return ONLY the JSON object matching the schema. No markdown, no commentary, just the JSON.`;

// Helper function to create CORS headers
function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// Helper to log detailed errors for wrangler tail
function logError(context: string, error: unknown, extra?: Record<string, unknown>) {
  const errorInfo = {
    context,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
    ...extra,
  };
  console.error(JSON.stringify(errorInfo));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

async function extractFromImage(env: Env, imageBase64: string, mimeType: string): Promise<ExtractedData> {
  const client = new OpenAI({
    apiKey: env.GEMINI_API_KEY,
    baseURL: env.GEMINI_BASE_URL,
  });

  const response = await client.chat.completions.create({
    model: "gemini-1.5-flash",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: USER_PROMPT },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
            },
          },
        ],
      },
    ],
    max_tokens: 4096,
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content || content.trim() === "") {
    logError("extractFromImage: Empty response from Gemini", new Error("Empty response"), {
      model: "gemini-1.5-flash",
    });
    throw new Error("Empty response from Gemini");
  }

  try {
    return JSON.parse(content) as ExtractedData;
  } catch (e) {
    logError("extractFromImage: Failed to parse JSON", e, {
      rawContent: content,
    });
    throw new Error(`Failed to parse extraction result: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function validateImageType(contentType: string): boolean {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/bmp",
    "image/tiff",
  ];
  return allowedTypes.includes(contentType.toLowerCase());
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders();

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    // Health check endpoint
    if (url.pathname === "/api/health" && request.method === "GET") {
      return new Response(JSON.stringify({ status: "ok", service: "arroyo-cv-scanner" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Scan endpoint
    if (url.pathname === "/api/scan" && request.method === "POST") {
      const startTime = Date.now();
      const requestId = crypto.randomUUID().slice(0, 8);

      try {
        // Check API key
        if (!env.GEMINI_API_KEY) {
          logError("Missing GEMINI_API_KEY", new Error("GEMINI_API_KEY not configured"), { requestId });
          return new Response(JSON.stringify({
            success: false,
            error: "GEMINI_API_KEY not configured in worker environment"
          }), {
            status: 500,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }

        const contentType = request.headers.get("content-type") || "";
        let imageBase64: string;
        let imageContentType = "image/jpeg";

        // Support both multipart/form-data (binary upload) and application/json (base64)
        if (contentType.includes("multipart/form-data")) {
          const formData = await request.formData();
          const imageFile = formData.get("image");

          if (!(imageFile instanceof File)) {
            logError("No image field in form data", new Error("Missing 'image' field"), {
              requestId,
              formKeys: Array.from(formData.keys()),
            });
            return new Response(JSON.stringify({
              success: false,
              error: "No image file provided (field name: 'image')"
            }), {
              status: 400,
              headers: { ...cors, "Content-Type": "application/json" },
            });
          }

          imageContentType = imageFile.type || "image/png";

          if (!validateImageType(imageContentType)) {
            logError("Unsupported image type", new Error("Invalid image type"), {
              requestId,
              contentType: imageFile.type,
            });
            return new Response(JSON.stringify({
              success: false,
              error: `Unsupported image type: ${imageFile.type}. Supported: JPEG, PNG, WebP, BMP, TIFF`
            }), {
              status: 400,
              headers: { ...cors, "Content-Type": "application/json" },
            });
          }

          try {
            imageBase64 = arrayBufferToBase64(await imageFile.arrayBuffer());
          } catch (e) {
            logError("Failed to read uploaded image", e, { requestId });
            throw new Error(`Failed to process image: ${e instanceof Error ? e.message : String(e)}`);
          }
        } else if (contentType.includes("application/json")) {
          // Support JSON with base64 image (for easier frontend integration)
          try {
            const json = await request.json();
            const base64Data = json.image || json.base64 || json.dataUrl;
            if (!base64Data) {
              logError("Missing image in JSON", new Error("No image field in JSON"), { requestId });
              return new Response(JSON.stringify({
                success: false,
                error: "Missing 'image' field in JSON body (expected base64 string or data URL)"
              }), {
                status: 400,
                headers: { ...cors, "Content-Type": "application/json" },
              });
            }

            // Handle data URL format (data:image/jpeg;base64,...) or raw base64
            if (base64Data.startsWith("data:")) {
              const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
              if (matches) {
                imageContentType = matches[1];
                imageBase64 = matches[2];
              } else {
                throw new Error("Invalid data URL format");
              }
            } else {
              imageBase64 = base64Data;
            }

            if (!validateImageType(imageContentType)) {
              logError("Unsupported image type (JSON)", new Error("Invalid image type"), {
                requestId,
                contentType: imageContentType,
              });
              return new Response(JSON.stringify({
                success: false,
                error: `Unsupported image type: ${imageContentType}. Supported: JPEG, PNG, WebP, BMP, TIFF`
              }), {
                status: 400,
                headers: { ...cors, "Content-Type": "application/json" },
              });
            }
          } catch (e) {
            logError("Failed to parse JSON request", e, { requestId });
            return new Response(JSON.stringify({
              success: false,
              error: `Invalid JSON request: ${e instanceof Error ? e.message : String(e)}`
            }), {
              status: 400,
              headers: { ...cors, "Content-Type": "application/json" },
            });
          }
        } else {
          logError("Invalid content type", new Error("Unsupported content type"), {
            requestId,
            contentType,
          });
          return new Response(JSON.stringify({
            success: false,
            error: "Content-Type must be multipart/form-data or application/json"
          }), {
            status: 400,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }

        logError("Starting Gemini extraction", new Error("DEBUG"), { requestId });
        const extractedData = await extractFromImage(env, imageBase64, imageContentType);

        const processingTime = Date.now() - startTime;

        logError("Extraction successful", new Error("DEBUG"), {
          requestId,
          processingTime,
          hasName: !!extractedData.fullName,
          hasEmail: !!extractedData.email,
          fieldsFound: Object.keys(extractedData).filter(k => extractedData[k as keyof ExtractedData] != null).length,
        });

        return new Response(JSON.stringify({
          success: true,
          data: extractedData,
          processingTime
        }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });

      } catch (error) {
        const processingTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        logError("Scan endpoint error", error, {
          requestId,
          processingTime,
          url: request.url,
        });

        return new Response(JSON.stringify({
          success: false,
          error: errorMessage,
          processingTime
        }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
    }

    // 404 for other routes
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
};
