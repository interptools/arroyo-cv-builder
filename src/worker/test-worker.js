/**
 * Test script for the Cloudflare Worker
 * Run with: node test-worker.js
 *
 * Requires:
 * - Worker running locally (wrangler dev)
 * - Test image file
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

const WORKER_URL = 'http://localhost:8787';
const TEST_IMAGE_PATH = process.argv[2] || './test-image.jpg';

async function testHealth() {
  console.log('🔍 Testing health endpoint...');
  try {
    const response = await fetch(`${WORKER_URL}/api/health`);
    const data = await response.json();
    console.log('✅ Health check:', data);
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

async function testScan() {
  console.log('\n📸 Testing scan endpoint...');

  if (!fs.existsSync(TEST_IMAGE_PATH)) {
    console.error(`❌ Test image not found: ${TEST_IMAGE_PATH}`);
    console.log('Usage: node test-worker.js <path-to-image>');
    return false;
  }

  const formData = new FormData();
  formData.append('image', fs.createReadStream(TEST_IMAGE_PATH));

  try {
    const startTime = Date.now();
    const response = await fetch(`${WORKER_URL}/api/scan`, {
      method: 'POST',
      body: formData,
    });
    const elapsed = Date.now() - startTime;

    const data = await response.json();

    if (data.success) {
      console.log(`✅ Scan successful (${elapsed}ms)`);
      console.log('📋 Extracted data:');
      console.log(JSON.stringify(data.data, null, 2));
    } else {
      console.error(`❌ Scan failed: ${data.error}`);
      console.log('Response:', JSON.stringify(data, null, 2));
    }
    return data.success;
  } catch (error) {
    console.error('❌ Scan request failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🧪 Cloudflare Worker Test Suite');
  console.log('================================');

  const healthOk = await testHealth();
  if (!healthOk) {
    console.log('\n⚠️  Make sure the worker is running: npm run dev');
    process.exit(1);
  }

  await testScan();

  console.log('\n✨ Test complete!');
}

main().catch(console.error);