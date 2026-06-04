import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Parse .env.local file to get the webhook secret
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../.env.local');

let secret = process.env.SIGNUP_WEBHOOK_SECRET;
let defaultUrl = 'http://localhost:3000';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const secretMatch = envContent.match(/^SIGNUP_WEBHOOK_SECRET\s*=\s*(.*)$/m);
  if (secretMatch && secretMatch[1]) {
    secret = secretMatch[1].trim().replace(/['"]/g, ''); // strip any quotes
  }
}

// Support passing the target URL as an argument
const targetArg = process.argv[2];
let targetBaseUrl = targetArg || defaultUrl;

// Ensure we have the full webhook endpoint path
if (!targetBaseUrl.endsWith('/api/webhooks/new-signup')) {
  targetBaseUrl = targetBaseUrl.replace(/\/$/, '') + '/api/webhooks/new-signup';
}

if (!secret) {
  console.error('❌ Error: SIGNUP_WEBHOOK_SECRET not found in environment or .env.local');
  process.exit(1);
}

// Generate random mock user details
const mockEmail = `test-user-${Math.floor(Math.random() * 100000)}@example.com`;
const mockId = 'd8c2c9d0-0cd8-46f2-b0fc-ba2f4aa1a3d5';
const mockDisplayName = 'Billionaire Brother Tester';
const mockTier = 'brother'; // free, brother, team
const mockPromoCode = 'TEST_WELCOME_100';

const payload = {
  type: 'INSERT',
  table: 'users',
  schema: 'auth',
  record: {
    id: mockId,
    email: mockEmail,
    created_at: new Date().toISOString(),
    raw_user_meta_data: {
      display_name: mockDisplayName,
      tier: mockTier,
      promo_code: mockPromoCode,
    }
  }
};

console.log(`Sending mock user signup event...`);
console.log(`Target URL: ${targetBaseUrl}`);
console.log(`Mock User Email: ${mockEmail}`);
console.log(`Mock Tier: ${mockTier}`);
console.log('----------------------------------------------------');

async function run() {
  try {
    const response = await fetch(targetBaseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': secret
      },
      body: JSON.stringify(payload)
    });

    const status = response.status;
    console.log(`Response Status: ${status} ${response.statusText}`);
    
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      console.log('Response JSON:', JSON.stringify(data, null, 2));
      if (response.ok && data.success) {
        console.log('\n✅ Success! Webhook processed mock signup event and triggered the email notification.');
      } else {
        console.log('\n❌ Webhook returned an error or non-success status.');
      }
    } catch {
      console.log('Response Body (raw):', text);
    }
  } catch (error) {
    console.error('❌ Network request failed:', error.message);
  }
}

run();
