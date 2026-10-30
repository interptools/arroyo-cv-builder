"""
Advanced Document Translator - Streamlit App
Upload an image, extract text with Gemini Vision, and get formatted translation output.
"""

import streamlit as st
import base64
import os
import traceback
import time
from openai import OpenAI, APITimeoutError, RateLimitError
from PIL import Image
import io


# Page configuration
st.set_page_config(
    page_title="Document Translator",
    page_icon="📄",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for better styling
st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        font-weight: 700;
        color: #1f2937;
        margin-bottom: 0.5rem;
    }
    .subtitle {
        font-size: 1.1rem;
        color: #6b7280;
        margin-bottom: 2rem;
    }
    .stTextArea textarea {
        font-family: 'Monospace', 'Consolas', monospace;
        font-size: 13px;
    }
    .output-box {
        background-color: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 1rem;
        font-family: monospace;
    }
    .success-banner {
        background-color: #d1fae5;
        border: 1px solid #a7f3d0;
        border-radius: 8px;
        padding: 1rem;
        margin: 1rem 0;
    }
    .error-box {
        background-color: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 8px;
        padding: 1rem;
        margin: 1rem 0;
        font-family: monospace;
        font-size: 13px;
        white-space: pre-wrap;
    }
</style>
""", unsafe_allow_html=True)


# Initialize session state
if "translation_result" not in st.session_state:
    st.session_state.translation_result = ""
if "processing" not in st.session_state:
    st.session_state.processing = False
if "last_error" not in st.session_state:
    st.session_state.last_error = ""
if "rate_limited" not in st.session_state:
    st.session_state.rate_limited = False
if "retry_count" not in st.session_state:
    st.session_state.retry_count = 0


# Gemini API base URL
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"

# Default model - using correct model name
DEFAULT_MODEL = "gemini-1.5-flash"


def get_gemini_client(api_key: str) -> OpenAI:
    """Create and return OpenAI-compatible client for Gemini API."""
    return OpenAI(
        api_key=api_key,
        base_url=GEMINI_BASE_URL,
        timeout=120.0
    )


def encode_image(image_file) -> str:
    """Encode uploaded image to base64, converting to JPEG if needed."""
    # Read the file
    image_bytes = image_file.read()
    image_file.seek(0)

    # Open with PIL to handle any format and convert to JPEG
    img = Image.open(io.BytesIO(image_bytes))

    # Convert RGBA to RGB if needed (JPEG doesn't support alpha)
    if img.mode in ('RGBA', 'LA', 'P'):
        # Create white background
        background = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
        img = background
    elif img.mode != 'RGB':
        img = img.convert('RGB')

    # Save as JPEG to bytes
    jpeg_buffer = io.BytesIO()
    img.save(jpeg_buffer, format='JPEG', quality=95)
    jpeg_bytes = jpeg_buffer.getvalue()

    return base64.b64encode(jpeg_bytes).decode("utf-8")


def build_prompt() -> str:
    """Build the system prompt for document translation - POSITIONAL TRANSCRIPTION MODE."""
    return """You are a visual transcription engine. Your ONLY task: read the image left-to-right, top-to-bottom, and output EVERY text element at its exact visual position using the syntax below.

SYNTAX (USE EXACTLY, NO VARIATIONS):
- ## Section Title          → for each distinct visual block/box (bordered area, header, footer)
- << Label >> Value         → for every label:value pair you see
- :: LeftLabel :: LeftVal :: RightLabel :: RightVal :: → for side-by-side fields (2-col)
- :: L1 :: V1 :: L2 :: V2 :: L3 :: V3 :: → for 3 columns
- :: Label :: Value ::      → for single field in a row
- Text without label        → output as-is on its own line

PROCEDURE - FOLLOW STEP BY STEP:
1. SCAN the image top to bottom. Identify every distinct visual block (bordered box, header bar, section).
2. For EACH block, output: ## Block Title
3. Within each block, read LEFT TO RIGHT, TOP TO BOTTOM.
4. For every text line you see:
   - If it has a LABEL and VALUE side by side → :: <<Label>> Value ::
   - If TWO pairs side by side → :: <<L1>> V1 :: <<L2>> V2 ::
   - If THREE pairs side by side → :: <<L1>> V1 :: <<L2>> V2 :: <<L3>> V3 ::
   - If just a label:value stacked → <<Label>> Value (each on own line)
   - If standalone text (heading, paragraph) → output the text as-is
5. Translate ALL text to English. Keep numbers/dates/names/IDs EXACT.
6. Empty value → [Empty]. Missing → [Not Found]. Checkbox → ☑/☐.
7. Signature/seal/photo → <<Type>> [Description - Position].

CRITICAL: The output order MUST match visual reading order exactly.
If the document has 2 columns, your :: rows MUST have 2 label-value pairs per line.
If the document has a paragraph, output it as a single line.
NO MARKDOWN TABLES. NO BULLETS. NO COMMENTARY. ONLY THE SYNTAX ABOVE.

EXAMPLE - Certificate with 2-column layout:

## Header
REPUBLIC OF THE PHILIPPINES
CERTIFICATE OF LIVE BIRTH

## Child Information
:: << Full Name >> JUAN DELA CRUZ :: << Sex >> MALE ::
:: << Date of Birth >> 2020-01-15 :: << Time of Birth >> 14:30 ::
:: << Place of Birth >> MANILA DOCTORS HOSPITAL :: << Registration No >> 2020-001234 ::

## Parent Information
:: << Father Name >> PEDRO DELA CRUZ :: << Mother Name >> MARIA SANTOS ::
:: << Father Citizenship >> FILIPINO :: << Mother Citizenship >> FILIPINO ::

## Registration
<< Registrar >> ATTY. JOSE RIZAL
<< Date Registered >> 2020-01-20

## Certification
<< Seal >> [Official Seal - Lower Center]
<< Signature >> [Registrar Signature - Lower Right]

OUTPUT ONLY THE FORMATTED RESULT. NOTHING ELSE."""


def process_image(client: OpenAI, image_b64: str, model: str = DEFAULT_MODEL, temperature: float = 0.1) -> tuple:
    """
    Send image to Gemini Vision and get formatted translation with retry logic.
    Returns: (success: bool, result: str, error_info: dict)
    """
    max_retries = 5
    base_delay = 5.0  # seconds

    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": build_prompt()
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "Transcribe this document image positionally. Read top-to-bottom, left-to-right. Output EVERY text element at its exact visual position using ONLY: ## for sections, :: for side-by-side fields (:: <<L>> V :: <<L>> V ::), << >> for label:value. NO markdown, NO bullets, NO commentary. Translate to English. Keep numbers/dates/names exact. Output ONLY the formatted result."
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_b64}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=4096,
                temperature=temperature
            )

            result = response.choices[0].message.content
            if not result or result.strip() == "":
                return False, "", {"type": "empty_response", "message": "Model returned empty response", "retryable": True}

            return True, result, {}

        except APITimeoutError as e:
            # Timeout errors are always retryable
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)
                time.sleep(delay)
                continue
            else:
                return False, "", {"type": "timeout", "message": f"Timeout after {max_retries} retries: {str(e)}", "retryable": True}

        except RateLimitError as e:
            # Rate limit errors - use longer delays
            if attempt < max_retries - 1:
                delay = base_delay * (3 ** attempt)  # 5s, 15s, 45s, 135s...
                time.sleep(delay)
                continue
            else:
                return False, "", {"type": "rate_limit", "message": f"Rate limit exceeded after {max_retries} retries: {str(e)}", "retryable": True, "reset_hint": "Free tier resets at midnight UTC. Try a different API key or wait."}

        except Exception as e:
            error_str = str(e)
            # Check for 503 (Service Unavailable) or 429 (Rate Limited) errors
            is_retryable = "503" in error_str or "429" in error_str or "Service Unavailable" in error_str or "Rate Limit" in error_str

            if is_retryable and attempt < max_retries - 1:
                # Exponential backoff: 5s, 10s, 20s, 40s...
                delay = base_delay * (2 ** attempt)
                time.sleep(delay)
                continue
            else:
                return False, "", {"type": "api_error", "message": f"{type(e).__name__}: {str(e)}", "retryable": is_retryable}


# ==================== MAIN UI ====================

# Header
st.markdown('<div class="main-header">📄 Advanced Document Translator</div>', unsafe_allow_html=True)
st.markdown('<div class="subtitle">Upload a document image → Gemini extracts, translates & formats with custom syntax</div>', unsafe_allow_html=True)

# Sidebar - Configuration
with st.sidebar:
    st.header("⚙️ Configuration")

    # API Key input - use environment variable or user input
    import os
    DEFAULT_API_KEY = os.environ.get("GEMINI_API_KEY", "")

    api_key = st.text_input(
        "Gemini API Key",
        type="password",
        value=DEFAULT_API_KEY,
        placeholder="AIza...",
        help="Your Google Gemini API key (never stored, used only for this session). Get one at https://aistudio.google.com/apikey"
    )

    # Model selection
    model = st.selectbox(
        "Model",
        ["gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro"],
        index=0,
        help="Gemini 1.5 Flash - fast and efficient. 1.5 Pro for higher quality."
    )

    # Temperature
    temperature = st.slider(
        "Temperature",
        0.0, 1.0, 0.1, 0.05,
        help="Lower = more deterministic, Higher = more creative"
    )

    st.divider()

    # Syntax reference
    with st.expander("📋 Syntax Reference", expanded=False):
        st.markdown("""
        **Section Header:** `## Section Name`

        **Data Field:** `<< Label >> Value`

        **3-Column Grid:** `:: Label :: Value :: Note`

        **Special Values:**
        - `[Not Found]` - Field exists but empty
        - `[Present - ...]` - Visual element detected
        - `☑ Checked` / `☐ Unchecked` - Checkboxes
        """)

    st.divider()

    # Cost estimate
    st.caption("💡 **Gemini Free Tier:**")
    st.caption("• 1,500 requests/day free")
    st.caption("• 1M tokens/minute free")
    st.caption("• Check https://ai.google.dev/pricing for current limits")

# Main content area
col1, col2 = st.columns([1, 1], gap="large")

with col1:
    st.subheader("📤 Upload Document")

    uploaded_file = st.file_uploader(
        "Choose an image file",
        type=["png", "jpg", "jpeg", "webp", "bmp", "tiff"],
        help="Supported formats: PNG, JPG, JPEG, WebP, BMP, TIFF. Max 20MB."
    )

    if uploaded_file:
        # Display uploaded image
        st.image(uploaded_file, caption="Uploaded Document", width='stretch')

        # File info
        file_size = len(uploaded_file.getvalue()) / 1024
        st.caption(f"📁 {uploaded_file.name} • {file_size:.1f} KB")

    # Process button
    process_disabled = not uploaded_file or not api_key or st.session_state.processing

    # Show rate limited status
    if st.session_state.rate_limited:
        st.error("🚫 **Rate Limited**: Free tier limit reached. Wait for reset (midnight UTC) or use a different API key.")
        if st.button("🔄 Retry Now", type="secondary", width='stretch'):
            st.session_state.rate_limited = False
            st.session_state.retry_count = 0
            st.rerun()

    if st.button(
        "🚀 Translate & Extract",
        type="primary",
        disabled=process_disabled,
        width='stretch'
    ):
        st.session_state.processing = True
        st.session_state.translation_result = ""
        st.session_state.last_error = ""
        st.session_state.rate_limited = False

        with st.spinner("Processing with Gemini Vision... This may take 10-30 seconds."):
            try:
                # Reset file pointer
                uploaded_file.seek(0)

                # Encode image (with PIL conversion to JPEG)
                image_b64 = encode_image(uploaded_file)

                # Create client and process
                client = get_gemini_client(api_key)
                success, result, error_info = process_image(client, image_b64, model)

                if success:
                    st.session_state.translation_result = result
                    st.session_state.retry_count = 0
                    st.success("✅ Translation complete!")
                else:
                    # Handle different error types
                    if error_info.get("type") == "rate_limit":
                        st.session_state.rate_limited = True
                        st.session_state.retry_count += 1
                        error_msg = f"🚫 **Rate Limit Exceeded**\n\n{error_info.get('message', 'Unknown error')}\n\n{error_info.get('reset_hint', '')}"
                    else:
                        error_msg = f"❌ **{error_info.get('type', 'Error').upper()}**\n\n{error_info.get('message', 'Unknown error')}"

                    st.session_state.last_error = error_msg
                    st.error(error_msg)

            except Exception as e:
                # Capture full traceback
                error_msg = f"{type(e).__name__}: {str(e)}\n\nFull traceback:\n{traceback.format_exc()}"
                st.session_state.last_error = error_msg
                st.error(f"❌ Error: {str(e)}")
            finally:
                st.session_state.processing = False
                st.rerun()

    # Display detailed error if any
    if st.session_state.last_error and not st.session_state.translation_result:
        st.markdown(f'<div class="error-box">{st.session_state.last_error}</div>', unsafe_allow_html=True)

    if not api_key:
        st.warning("⚠️ Please enter your Gemini API key in the sidebar")
    elif not uploaded_file:
        st.info("👆 Upload an image to begin")

with col2:
    st.subheader("📋 Formatted Output")

    if st.session_state.translation_result:
        # Success banner
        st.markdown('<div class="success-banner">✅ Translation ready — copy the formatted text below</div>', unsafe_allow_html=True)

        # Output text area (read-only, copyable)
        st.text_area(
            "Result (Custom Syntax Format)",
            value=st.session_state.translation_result,
            height=500,
            help="Select all (Ctrl+A) and copy (Ctrl+C) to use the formatted output",
            key="output_area"
        )

        # Download button
        st.download_button(
            label="💾 Download as .txt",
            data=st.session_state.translation_result,
            file_name=f"translation_{uploaded_file.name.split('.')[0] if uploaded_file else 'output'}.txt",
            mime="text/plain",
            width='stretch'
        )

        # Copy button
        if st.button("📋 Copy to Clipboard", width='stretch'):
            st.toast("Copied! (Use Ctrl+A, Ctrl+C from the text area above)")

    else:
        # Empty state
        st.markdown("""
        <div class="output-box" style="height: 400px; display: flex; align-items: center; justify-content: center; color: #9ca3af;">
            Upload an image and click "Translate & Extract" to see the formatted output here.
        </div>
        """, unsafe_allow_html=True)

# Footer
st.divider()
st.caption("Built with Streamlit + Google Gemini Vision | Custom syntax for structured document extraction")