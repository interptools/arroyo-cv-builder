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

// Parse multipart/form-data from binary ArrayBuffer
async function parseMultipartFormDataBinary(
  buffer: ArrayBuffer,
  boundary: string
): Promise<Map<string, { filename?: string; contentType?: string; data: Uint8Array }>> {
  const parts = new Map<string, { filename?: string; contentType?: string; data: Uint8Array }>();
  const delimiter = `--${boundary}`;
  const delimiterBytes = new TextEncoder().encode(delimiter);
  const endDelimiterBytes = new TextEncoder().encode(`${delimiter}--`);

  const view = new Uint8Array(buffer);
  let offset = 0;

  while (offset < view.length) {
    // Find next delimiter
    let delimiterIndex = -1;
    for (let i = offset; i <= view.length - delimiterBytes.length; i++) {
      let match = true;
      for (let j = 0; j < delimiterBytes.length; j++) {
        if (view[i + j] !== delimiterBytes[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        delimiterIndex = i;
        break;
      }
    }

    if (delimiterIndex === -1) break;

    // Check if this is the end delimiter
    let isEnd = true;
    for (let j = 0; j < endDelimiterBytes.length; j++) {
      if (view[delimiterIndex + j] !== endDelimiterBytes[j]) {
        isEnd = false;
        break;
      }
    }
    if (isEnd) break;

    const partStart = delimiterIndex + delimiterBytes.length;
    offset = partStart;

    // Find the end of headers (\r\n\r\n)
    let headerEnd = -1;
    for (let i = offset; i <= view.length - 4; i++) {
      if (view[i] === 0x0d && view[i + 1] === 0x0a && view[i + 2] === 0x0d && view[i + 3] === 0x0a) {
        headerEnd = i;
        break;
      }
    }

    if (headerEnd === -1) break;

    // Parse headers
    const headerBytes = view.slice(offset, headerEnd);
    const headersText = new TextDecoder().decode(headerBytes);

    // Find next delimiter for this part's data
    let nextDelimiterIndex = -1;
    for (let i = headerEnd + 4; i <= view.length - delimiterBytes.length; i++) {
      let match = true;
      for (let j = 0; j < delimiterBytes.length; j++) {
        if (view[i + j] !== delimiterBytes[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        nextDelimiterIndex = i;
        break;
      }
    }

    if (nextDelimiterIndex === -1) break;

    // Extract data (between headers and next delimiter)
    const dataStart = headerEnd + 4;
    const dataEnd = nextDelimiterIndex - 2; // Remove trailing \r\n
    const dataBytes = view.slice(dataStart, dataEnd);

    // Parse headers for metadata
    const contentDisposition = headersText.match(/name="([^"]+)"/)?.[1];
    if (!contentDisposition) {
      offset = nextDelimiterIndex;
      continue;
    }

    const filename = headersText.match(/filename="([^"]+)"/)?.[1];
    const contentType = headersText.match(/Content-Type:\s*([^\r\n]+)/i)?.[1]?.trim();

    parts.set(contentDisposition, {
      filename,
      contentType,
      data: dataBytes,
    });

    offset = nextDelimiterIndex;
  }

  return parts;
}

async function extractFromImage(env: Env, imageBase64: string): Promise<ExtractedData> {
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
              url: `data:image/jpeg;base64=${imageBase64}`,
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

        // Parse multipart form data from binary
        const contentType = request.headers.get("content-type") || "";
        if (!contentType.includes("multipart/form-data")) {
          logError("Invalid content type", new Error("Not multipart/form-data"), {
            requestId,
            contentType,
          });
          return new Response(JSON.stringify({
            success: false,
            error: "Content-Type must be multipart/form-data"
          }), {
            status: 400,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }

        const boundaryMatch = contentType.match(/boundary=([^;]+)/);
        const boundary = boundaryMatch ? boundaryMatch[1].trim() : "";
        if (!boundary) {
          logError("Missing boundary", new Error("No boundary in content-type"), {
            requestId,
            contentType,
          });
          return new Response(JSON.stringify({
            success: false,
            error: "Missing boundary in multipart/form-data"
          }), {
            status: 400,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }

        // Get raw binary data
        const arrayBuffer = await request.arrayBuffer();
        if (arrayBuffer.byteLength === 0) {
          logError("Empty request body", new Error("No data received"), { requestId });
          return new Response(JSON.stringify({
            success: false,
            error: "Empty request body"
          }), {
            status: 400,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }

        // Parse multipart form data
        const parts = await parseMultipartFormDataBinary(arrayBuffer, boundary);

        const imagePart = parts.get("image");
        if (!imagePart) {
          logError("No image field in form data", new Error("Missing 'image' field"), {
            requestId,
            availableFields: Array.from(parts.keys()),
          });
          return new Response(JSON.stringify({
            success: false,
            error: "No image file provided (field name: 'image')"
          }), {
            status: 400,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }

        if (!validateImageType(imagePart.contentType || "")) {
          logError("Unsupported image type", new Error("Invalid image type"), {
            requestId,
            contentType: imagePart.contentType,
          });
          return new Response(JSON.stringify({
            success: false,
            error: `Unsupported image type: ${imagePart.contentType}. Supported: JPEG, PNG, WebP, BMP, TIFF`
          }), {
            status: 400,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }

        // Convert binary image data to base64
        let imageBase64: string;
        try {
          // Convert Uint8Array to base64
          const bytes = imagePart.data;
          let binary = "";
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          imageBase64 = btoa(binary);

          logError("Image processed", new Error("DEBUG"), {
            requestId,
            filename: imagePart.filename,
            contentType: imagePart.contentType,
            size: bytes.length,
            base64Length: imageBase64.length,
          });
        } catch (e) {
          logError("Failed to convert image to base64", e, { requestId });
          throw new Error(`Failed to process image: ${e instanceof Error ? e.message : String(e)}`);
        }

        // Extract data from image
        logError("Starting Gemini extraction", new Error("DEBUG"), { requestId });
        const extractedData = await extractFromImage(env, imageBase64);

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