const fs = require('fs');

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf-8')
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

for (const [k, v] of Object.entries(env)) {
  process.env[k] = v;
}

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const client = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

async function test() {
  const cmd = new SendEmailCommand({
    Source: process.env.AWS_SES_FROM_EMAIL,
    Destination: { ToAddresses: ['tech@sienvi.com'] },
    ConfigurationSetName: process.env.AWS_SES_CONFIGURATION_SET,
    Message: {
      Subject: { Data: '👑 [SES Live Test] agentic-billionaire-brother Setup Verified' },
      Body: {
        Html: { Data: '<h2>👑 The Billionaire Brother</h2><p>Amazon SES is active and configured matching sienvi-sender-test.</p>' }
      }
    }
  });

  const res = await client.send(cmd);
  console.log('✅ SES Send Successful! MessageId:', res.MessageId);
}
test();
