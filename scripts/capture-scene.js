import { chromium } from 'playwright';
import path from 'path';

async function capture() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--enable-webgl', '--use-gl=angle'],
  });

  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  });

  page.on('console', (msg) => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.error('PAGE ERROR:', err));

  console.log('Navigating to https://localhost:8081/...');
  await page.goto('https://localhost:8081/', { waitUntil: 'networkidle', timeout: 30000 });

  console.log('Waiting for 3D scene & WebGL canvas...');
  await page.waitForTimeout(4000);

  const outPath = path.resolve('screenshot-carrom-3d-visual.png');
  await page.screenshot({ path: outPath });
  console.log('Screenshot saved to:', outPath);

  // Click on "PLAY ALONE" button in UI to show gameplay view!
  try {
    console.log('Clicking PLAY ALONE button...');
    await page.click('#btn-play-alone', { timeout: 3000 });
    await page.waitForTimeout(1500);
    const gameplayPath = path.resolve('screenshot-carrom-gameplay-visual.png');
    await page.screenshot({ path: gameplayPath });
    console.log('Gameplay screenshot saved to:', gameplayPath);
  } catch (err) {
    console.log('Could not click #btn-play-alone:', err.message);
  }

  await browser.close();
}

capture().catch((err) => {
  console.error('Capture error:', err);
  process.exit(1);
});
