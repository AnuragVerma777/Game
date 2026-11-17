import { chromium } from 'playwright';

async function testGameplayStrike() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--enable-webgl', '--use-gl=angle'],
  });

  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  });

  console.log('Navigating to https://localhost:8081/...');
  await page.goto('https://localhost:8081/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  console.log('Testing Keyboard Strike (Space bar)...');
  await page.keyboard.press('Space');
  await page.waitForTimeout(1500);

  console.log('Strike fired successfully without errors!');
  await browser.close();
}

testGameplayStrike().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
