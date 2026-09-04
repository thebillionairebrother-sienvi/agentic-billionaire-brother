const { chromium } = require('playwright');
const fs = require('fs');

async function renderLogo() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 512, height: 512, deviceScaleFactor: 2 } });
  
  const svgContent = fs.readFileSync('public/billionaire-brother-logo.svg', 'utf-8');
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { margin: 0; padding: 0; background: transparent; display: flex; align-items: center; justify-content: center; width: 512px; height: 512px; }
        svg { width: 512px; height: 512px; }
      </style>
    </head>
    <body>
      ${svgContent}
    </body>
    </html>
  `);

  await page.screenshot({ path: 'public/billionaire-brother-logo.png', omitBackground: true });
  await browser.close();
  console.log('✅ Successfully generated public/billionaire-brother-logo.png');
}
renderLogo().catch(console.error);
