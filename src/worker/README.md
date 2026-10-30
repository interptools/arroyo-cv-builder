# Arroyo CV Scanner Worker

Cloudflare Worker that provides document scanning/OCR API for the **arroyo-cv-builder** GitHub Pages site.

## Features

- 📸 **Image Upload**: Accept CV/Resume images via multipart/form-data
- 🔍 **AI-Powered Extraction**: Uses Google Gemini Vision to extract structured data
- 📝 **Auto-Fill Ready**: Returns structured JSON perfect for form auto-fill
- 🌐 **CORS Enabled**: Works directly from GitHub Pages (https://interptools.github.io/arroyo-cv-builder/)
- ⚡ **Fast**: Runs on Cloudflare's edge network

## Quick Start

```bash
# 1. Navigate to worker directory
cd src/worker

# 2. Install dependencies
npm install

# 3. Set your Gemini API key (get from https://aistudio.google.com/apikey)
wrangler secret put GEMINI_API_KEY

# 4. Start local development
npm run dev

# 5. Test with an image
npm test ./path/to/resume.jpg
```

## API

### POST `/api/scan`
Upload a CV/Resume image and get structured data back.

**Request**: multipart/form-data with field `image`

**Response**:
```json
{
  "success": true,
  "data": {
    "fullName": "John Doe",
    "email": "john@example.com",
    "phone": "+1-555-123-4567",
    "summary": "Experienced developer...",
    "experience": [...],
    "education": [...],
    "skills": ["JavaScript", "React", "Node.js"],
    "projects": [...],
    "certifications": [...],
    "languages": [...],
    "rawText": "Full extracted text..."
  },
  "processingTime": 2341
}
```

### GET `/api/health`
Health check endpoint.

## Deploy to Cloudflare

```bash
# Deploy to Cloudflare Workers
npm run deploy
```

Your worker will be available at: `https://arroyo-cv-scanner.<your-subdomain>.workers.dev`

## Integration with arroyo-cv-builder

Add this JavaScript to your GitHub Pages site:

```javascript
// Scan and auto-fill form
async function scanAndFill(imageFile) {
  const formData = new FormData();
  formData.append('image', imageFile);

  const response = await fetch('https://arroyo-cv-scanner.<your-subdomain>.workers.dev/api/scan', {
    method: 'POST',
    body: formData
  });

  const result = await response.json();
  if (result.success) {
    fillForm(result.data);
  }
}

function fillForm(data) {
  // Map extracted data to form fields
  const fields = ['fullName', 'email', 'phone', 'address', 'linkedin', 'github', 'website', 'summary'];
  fields.forEach(field => {
    const el = document.getElementById(field);
    if (el && data[field]) el.value = data[field];
  });

  // Handle arrays (skills, experience, etc.)
  if (data.skills) document.getElementById('skills').value = data.skills.join(', ');
  // ... handle experience, education, projects, etc.
}
```

## Configuration

Environment variables (set via `wrangler secret put` or Cloudflare Dashboard):

| Variable | Description | Default |
|----------|-------------|---------|
| `GEMINI_API_KEY` | Google Gemini API key | Required |
| `GEMINI_BASE_URL` | API base URL | `https://generativelanguage.googleapis.com/v1beta/openai/` |

## Supported Image Formats

- JPEG/JPG
- PNG
- WebP
- BMP
- TIFF

## Limits

- Request body: 100MB (Cloudflare Workers limit)
- Gemini free tier: 1,500 requests/day
- Processing time: ~2-5 seconds per image

## Project Structure

```
src/worker/
├── index.ts          # Main worker code
├── package.json      # Dependencies
├── tsconfig.json     # TypeScript config
├── DEPLOYMENT.md     # Detailed deployment guide
├── test-worker.js    # Test script
└── README.md         # This file
```

## Troubleshooting

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed troubleshooting guide.