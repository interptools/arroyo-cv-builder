#!/usr/bin/env python
"""
Test script to verify OpenAI API key and gpt-4o access.
"""
import os
import sys
from openai import OpenAI

def main():
    # Get API key from environment
    api_key = os.environ.get("OPENAI_API_KEY")

    if not api_key:
        print("❌ ERROR: OPENAI_API_KEY environment variable not set")
        print("   Set it with: $env:OPENAI_API_KEY='sk-...'")
        sys.exit(1)

    print(f"🔑 Using API key: {api_key[:10]}...{api_key[-4:]}")
    print("📡 Sending test request to gpt-4o...")

    try:
        client = OpenAI(api_key=api_key)

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Reply with exactly: 'API test successful'"}
            ],
            max_tokens=20,
            temperature=0
        )

        result = response.choices[0].message.content
        print(f"✅ SUCCESS: {result}")

    except Exception as e:
        print(f"❌ ERROR: {type(e).__name__}: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()