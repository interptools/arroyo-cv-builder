# Arroyo CV Scanner Worker - Deployment Guide

## Overview
This Cloudflare Worker provides a document scanning API for the **arroyo-cv-builder** GitHub Pages site (https://interptools.github.io/arroyo-cv-builder/).

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/scan` | Upload image (multipart/form-data, field: `image`) and extract structured CV data |

## Local Development

```bash
cd src/worker
npm install
npm run dev
```

The worker will be available at `http://localhost:8787`

### Test locally with curl:

```bash
# Health check
curl http://localhost:8787/api/health

# Scan an image
curl -X POST http://localhost:8787/api/scan \
  -F "image=@/path/to/resume.jpg"
```

## Configuration

### Required Environment Variables (set in Cloudflare Dashboard or wrangler.toml)

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key (from https://aistudio.google.com/apikey) | Yes |
| `GEMINI_BASE_URL` | Gemini API base URL (default: https://generativelanguage.googleapis.com/v1beta/openai/) | No |

### Set secrets in Cloudflare:

```bash
wrangler secret put GEMINI_API_KEY
```

## Deployment

### 1. Install Wrangler globally (if not already)
```bash
npm install -g wrangler
```

### 2. Login to Cloudflare
```bash
wrangler login
```

### 3. Set the GEMINI_API_KEY secret
```bash
wrangler secret put GEMINI_API_KEY
# Enter your Gemini API key when prompted
```

### 4. Deploy
```bash
cd src/worker
npm run deploy
```

The worker will be deployed to: `https://arroyo-cv-scanner.<your-subdomain>.workers.dev`

## Integration with arroyo-cv-builder (GitHub Pages)

### Frontend JavaScript Example:

```javascript
// In your arroyo-cv-builder site
async function scanDocument(imageFile) {
  const formData = new FormData();
  formData.append('image', imageFile);

  const response = await fetch('https://arroyo-cv-scanner.<your-subdomain>.workers.dev/api/scan', {
    method: 'POST',
    body: formData
  });

  const result = await response.json();
  
  if (result.success) {
    // Auto-fill form fields with extracted data
    autoFillForm(result.data);
  } else {
    console.error('Scan failed:', result.error);
  }
}

function autoFillForm(data) {
  // Personal info
  if (data.fullName) document.getElementById('fullName').value = data.fullName;
  if (data.email) document.getElementById('email').value = data.email;
  if (data.phone) document.getElementById('phone').value = data.phone;
  if (data.address) document.getElementById('address').value = data.address;
  if (data.linkedin) document.getElementById('linkedin').value = data.linkedin;
  if (data.github) document.getElementById('github').value = data.github;
  if (data.website) document.getElementById('website').value = data.website;

  // Summary
  if (data.summary) document.getElementById('summary').value = data.summary;

  // Experience
  if (data.experience && data.experience.length > 0) {
    // Populate experience fields
    data.experience.forEach((exp, index) => {
      // Add to experience section
    });
  }

  // Skills
  if (data.skills && data.skills.length > 0) {
    document.getElementById('skills').value = data.skills.join(', ');
  }

  // Education, Projects, Certifications, Languages...
  // Similar pattern
}
```

### HTML Form Example:

```html
<form id="cv-form">
  <input type="file" id="resume-upload" accept="image/*" onchange="handleFileSelect(event)">
  <button type="button" onclick="scanAndFill()">Scan & Auto-Fill</button>
  
  <!-- Form fields that will be auto-filled -->
  <input type="text" id="fullName" placeholder="Full Name">
  <input type="email" id="email" placeholder="Email">
  <input type="tel" id="phone" placeholder="Phone">
  <textarea id="summary" placeholder="Professional Summary"></textarea>
  <!-- ... more fields -->
</form>

<script>
async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    await scanDocument(file);
  }
}
</script>
```

## Response Format

### Success Response:
```json
{
  "success": true,
  "data": {
    "fullName": "John Doe",
    "email": "john@example.com",
    "phone": "+1-555-123-4567",
    "address": "San Francisco, CA",
    "linkedin": "linkedin.com/in/johndoe",
    "github": "github.com/johndoe",
    "website": "johndoe.dev",
    "summary": "Experienced software engineer...",
    "experience": [
      {
        "title": "Senior Software Engineer",
        "company": "Tech Corp",
        "location": "San Francisco, CA",
        "startDate": "2020-01",
        "endDate": "2023-12",
        "current": false,
        "description": ["Led team of 5", "Built microservices", "Reduced latency 40%"]
      }
    ],
    "education": [
      {
        "degree": "BS Computer Science",
        "institution": "Stanford University",
        "location": "Stanford, CA",
        "graduationDate": "2019",
        "gpa": "3.8"
      }
    ],
    "skills": ["JavaScript", "TypeScript", "React", "Node.js", "AWS"],
    "projects": [
      {
        "name": "Project Alpha",
        "description": "Real-time collaboration tool",
        "technologies": ["React", "WebSocket"],
        "link": "github.com/johndoe/alpha"
      }
    ],
    "certifications": [],
    "languages": [
      { "name": "English", "proficiency": "Native" },
      { "name": "Spanish", "proficiency": "Fluent" }
    ],
    "rawText": "Full extracted text..."
  },
  "processingTime": 2341
}
```

### Error Response:
```json
{
  "success": false,
  "error": "Error description",
  "processingTime": 100
}
```

## Troubleshooting

### Common Issues:

1. **"GEMINI_API_KEY not configured"**
   - Set the secret: `wrangler secret put GEMINI_API_KEY`

2. **CORS errors from GitHub Pages**
   - The worker includes CORS headers (`Access-Control-Allow-Origin: *`)
   - Ensure you're calling the correct worker URL

3. **Image upload fails**
   - Check file size (Cloudflare Workers limit: 100MB for request body)
   - Supported formats: JPEG, PNG, WebP, BMP, TIFF

4. **Extraction quality issues**
   - Ensure image is clear and readable
   - Try higher resolution images
   - The prompt is optimized for CV/Resume format

5. **Rate limiting**
   - Gemini free tier: 1,500 requests/day
   - Consider upgrading for production use

## Monitoring

View logs and metrics in Cloudflare Dashboard:
- Workers & Pages > arroyo-cv-scanner > Logs/Analytics
- Observability is enabled in wrangler.jsonc

## Security Notes

- Never commit API keys to git
- Use `wrangler secret put` for sensitive values
- The worker validates image MIME types
- CORS is open (`*`) for GitHub Pages integration - restrict if needed