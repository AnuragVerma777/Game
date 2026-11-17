/**
 * Records an authentic, complete gameplay walkthrough video of CARROM CLASH
 * using Playwright's built-in Chromium video recorder.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function recordWalkthrough() {
  console.log('--- STARTING GAMEPLAY WALKTHROUGH VIDEO RECORDING ---');

  const videoDir = path.resolve('docs/videos');
  if (!fs.existsSync(videoDir)) {
    fs.mkdirSync(videoDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--use-gl=swiftshader']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    recordVideo: {
      dir: videoDir,
      size: { width: 1280, height: 720 }
    }
  });

  const page = await context.newPage();

  try {
    console.log('1. Loading CARROM CLASH on https://localhost:8081/ ...');
    await page.goto('https://localhost:8081/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);
    await page.waitForFunction(() => !!window.__carromSystem, { timeout: 15000 });

    // Step 1: Showcase Main Menu for 3 seconds
    console.log('2. Showcasing Main Start Screen...');
    await page.waitForTimeout(3000);

    // Step 2: Click "PLAY ALONE"
    console.log('3. Clicking "PLAY ALONE" button...');
    const playAloneCoords = await page.evaluate(() => {
      const sys = window.__carromSystem;
      const btn = sys.panelAsset.getElementById('btn-play-alone');
      const pos = new sys.camera.position.constructor();
      btn.getWorldPosition(pos);
      pos.project(sys.camera);
      const rect = sys.renderer.domElement.getBoundingClientRect();
      return {
        x: ((pos.x + 1) * rect.width) / 2 + rect.left,
        y: ((-pos.y + 1) * rect.height) / 2 + rect.top
      };
    });
    await page.mouse.click(playAloneCoords.x, playAloneCoords.y);
    await page.waitForTimeout(2000);

    // Step 3: Click "SOLO PRACTICE"
    console.log('4. Clicking "SOLO PRACTICE" button...');
    const soloPracticeCoords = await page.evaluate(() => {
      const sys = window.__carromSystem;
      const btn = sys.panelAsset.getElementById('btn-alone-practice');
      const pos = new sys.camera.position.constructor();
      btn.getWorldPosition(pos);
      pos.project(sys.camera);
      const rect = sys.renderer.domElement.getBoundingClientRect();
      return {
        x: ((pos.x + 1) * rect.width) / 2 + rect.left,
        y: ((-pos.y + 1) * rect.height) / 2 + rect.top
      };
    });
    await page.mouse.click(soloPracticeCoords.x, soloPracticeCoords.y);
    await page.waitForTimeout(2000);

    // Verify GAMEPLAY view
    const viewState = await page.evaluate(() => window.__carromSystem.currentView);
    console.log('   Current View State:', viewState);

    // Step 4: Demonstrate Striker Baseline Sliding
    console.log('5. Demonstrating smooth striker baseline sliding (Left & Right)...');
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('KeyA');
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(500);
    for (let i = 0; i < 16; i++) {
      await page.keyboard.press('KeyD');
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(500);
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('KeyA');
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(800);

    // Step 5: Slingshot Aim & Power build-up
    console.log('6. Demonstrating slingshot aiming & power build-up...');
    const strikerCoords = await page.evaluate(() => {
      const sys = window.__carromSystem;
      const pos = sys.strikerMesh.position.clone();
      pos.project(sys.camera);
      const rect = sys.renderer.domElement.getBoundingClientRect();
      return {
        x: ((pos.x + 1) * rect.width) / 2 + rect.left,
        y: ((-pos.y + 1) * rect.height) / 2 + rect.top
      };
    });

    // Mouse down on striker
    await page.mouse.move(strikerCoords.x, strikerCoords.y);
    await page.mouse.down();
    await page.waitForTimeout(300);

    // Drag backward smoothly to build power
    for (let step = 1; step <= 25; step++) {
      await page.mouse.move(strikerCoords.x, strikerCoords.y + step * 3);
      await page.waitForTimeout(40);
    }
    await page.waitForTimeout(1000);

    // Release mouse to fire break shot!
    console.log('7. Releasing shot — The Break Shot!');
    await page.mouse.up();

    // Step 6: Watch physical collisions and cushion rebounds
    console.log('8. Simulating collisions, cushion rebounds, and friction...');
    await page.waitForTimeout(4500);

    // Step 7: Fire second precision shot
    console.log('9. Lining up second strategic shot...');
    await page.evaluate(() => {
      const sys = window.__carromSystem;
      sys.setStrikerBaselineX(0.12);
      sys.fireShot(-0.8, -2.4, 0.75);
    });
    await page.waitForTimeout(4000);

    // Step 8: Re-rack Pieces Demonstration
    console.log('10. Demonstrating instant re-rack (Press R)...');
    await page.keyboard.press('KeyR');
    await page.waitForTimeout(2000);

    // Step 9: Return to Main Menu
    console.log('11. Returning to Main Menu (Press M)...');
    await page.keyboard.press('KeyM');
    await page.waitForTimeout(2500);

    console.log('12. Finalizing walkthrough recording...');
  } catch (err) {
    console.error('WALKTHROUGH ERROR:', err);
  } finally {
    // Get the video file path before closing
    const video = page.video();
    await page.close();
    await context.close();
    await browser.close();

    if (video) {
      const recordedPath = await video.path();
      const finalDest = path.resolve('docs/videos/carrom-clash-walkthrough.webm');
      fs.copyFileSync(recordedPath, finalDest);
      const stats = fs.statSync(finalDest);
      console.log(`\n======================================================`);
      console.log(`WALKTHROUGH VIDEO SAVED: ${finalDest} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`======================================================\n`);
    }
  }
}

recordWalkthrough();
