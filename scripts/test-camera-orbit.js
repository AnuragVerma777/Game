import { chromium } from 'playwright';
import path from 'path';

async function testCameraOrbitAndZoom() {
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

  console.log('Testing Right-Click Orbit Rotation...');
  // Move to side of canvas and right-click drag to rotate camera
  await page.mouse.move(200, 300);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(450, 320, { steps: 20 });
  await page.mouse.up({ button: 'right' });

  // Wait for smooth lerp damping
  await page.waitForTimeout(1000);

  console.log('Testing Wheel Zoom In...');
  await page.mouse.move(640, 360);
  await page.mouse.wheel(0, -350); // Zoom in
  await page.waitForTimeout(1200);

  const outPath = path.resolve('screenshot-carrom-orbit-zoom.png');
  await page.screenshot({ path: outPath });
  console.log('Orbit & Zoom screenshot saved to:', outPath);

  await browser.close();
}

testCameraOrbitAndZoom().catch((err) => {
  console.error('Camera test error:', err);
  process.exit(1);
});
