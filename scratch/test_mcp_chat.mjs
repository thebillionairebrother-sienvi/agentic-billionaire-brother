import fs from 'fs';
import path from 'path';

// Parse .env.local manually
const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = val;
    }
  }
}

const mcpApiKey = process.env.MCP_API_KEY;

if (!mcpApiKey) {
  console.error('Missing MCP_API_KEY in .env.local');
  process.exit(1);
}

async function main() {
  const baseUrl = 'http://localhost:3000';

  console.log('Fetching a test user from the local Next.js API server...');
  let testUser;
  try {
    const usersRes = await fetch(`${baseUrl}/api/mcp/users`, {
      headers: {
        'Authorization': `Bearer ${mcpApiKey}`
      }
    });
    if (!usersRes.ok) {
      const body = await usersRes.json();
      console.error(`Failed to fetch users: HTTP ${usersRes.status}`, body);
      process.exit(1);
    }
    const usersData = await usersRes.json();
    if (!usersData.success || !usersData.data || usersData.data.length === 0) {
      console.error('No users returned from database:', usersData);
      process.exit(1);
    }
    testUser = usersData.data[0];
  } catch (err) {
    console.error('Fetch error during user lookup:', err.message);
    process.exit(1);
  }

  console.log(`Using test user: ID=${testUser.id}, Email=${testUser.email}`);

  console.log('\n--- Test 1: POST /api/mcp/chat (Unauthorized - Missing Key) ---');
  try {
    const res = await fetch(`${baseUrl}/api/mcp/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: testUser.id,
        message: 'Hello, Derek'
      })
    });
    console.log('Status:', res.status);
    console.log('Body:', await res.json());
  } catch (err) {
    console.error('Fetch error:', err.message);
  }

  console.log('\n--- Test 2: POST /api/mcp/chat (Unauthorized - Invalid Key) ---');
  try {
    const res = await fetch(`${baseUrl}/api/mcp/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer WRONG_KEY'
      },
      body: JSON.stringify({
        user_id: testUser.id,
        message: 'Hello, Derek'
      })
    });
    console.log('Status:', res.status);
    console.log('Body:', await res.json());
  } catch (err) {
    console.error('Fetch error:', err.message);
  }

  console.log('\n--- Test 3: POST /api/mcp/chat (Bad Request - Missing user_id) ---');
  try {
    const res = await fetch(`${baseUrl}/api/mcp/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mcpApiKey}`
      },
      body: JSON.stringify({
        message: 'Hello, Derek'
      })
    });
    console.log('Status:', res.status);
    console.log('Body:', await res.json());
  } catch (err) {
    console.error('Fetch error:', err.message);
  }

  console.log('\n--- Test 4: POST /api/mcp/chat (Successful response) ---');
  try {
    const res = await fetch(`${baseUrl}/api/mcp/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mcpApiKey}`
      },
      body: JSON.stringify({
        user_id: testUser.id,
        message: 'Yo Derek, give me a quick 1-sentence tip on outbound marketing.'
      })
    });
    console.log('Status:', res.status);
    console.log('Body:', JSON.stringify(await res.json(), null, 2));
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

main();
