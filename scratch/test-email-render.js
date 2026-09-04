const { chromium } = require('playwright');
const fs = require('fs');

async function testEmailRender() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 600, height: 800, deviceScaleFactor: 2 } });
  
  let html = fs.readFileSync('emails/confirm-signup.html', 'utf-8');
  // Use the local file as image source for preview screenshot
  const base64Img = fs.readFileSync('public/billionaire-brother-logo.png').toString('base64');
  html = html.replace(
    'https://mybillionairebrother.com/billionaire-brother-logo.png',
    `data:image/png;base64,${base64Img}`
  );

  await page.setContent(html);
  await page.screenshot({ path: 'scratch/email-preview.png', fullPage: true });
  await browser.close();
  console.log('✅ Generated scratch/email-preview.png');
}
testEmailRender().catch(console.error);
