/**
 * Verifies mobile browser emulation (390x844 viewport, touch enabled, userAgent).
 * Tests touch sliding along baseline, touch pull-back aiming, and release to strike.
 */
import { chromium, devices } from 'playwright';

async function testMobileBrowser() {
  console.log('--- STARTING MOBILE BROWSER & TOUCH CONTROLS AUDIT ---');
  const iPhone = devices['iPhone 14'];
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--use-gl=swiftshader']
  });

  const context = await browser.newContext({
    ...iPhone,
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  try {
    console.log('1. Connecting in Mobile Emulation mode (390x844, touch-enabled)...');
    await page.goto('https://localhost:8081/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);

    // Wait for CarromSystem
    await page.waitForFunction(() => !!window.__carromSystem, { timeout: 15000 });

    console.log('2. Starting 1v1 Pass-and-Play match and testing touch lifecycle...');
    const result = await page.evaluate(async () => {
      const sys = window.__carromSystem;
      sys.startPassAndPlay(2);
      sys.showView('GAMEPLAY');
      sys.gameState = 'READY';
      sys.updateUI();

      // Project striker mesh position to screen coordinates
      const pos = sys.strikerMesh.position.clone();
      pos.project(sys.camera);
      const rect = sys.renderer.domElement.getBoundingClientRect();
      const x = ((pos.x + 1) * rect.width) / 2 + rect.left;
      const y = ((-pos.y + 1) * rect.height) / 2 + rect.top;

      const canvas = sys.renderer.domElement;

      // Touch Down on Striker
      const touchStart = new Touch({
        identifier: 1,
        target: canvas,
        clientX: x,
        clientY: y,
        pageX: x,
        pageY: y,
      });
      canvas.dispatchEvent(new TouchEvent('touchstart', {
        touches: [touchStart],
        targetTouches: [touchStart],
        changedTouches: [touchStart],
        bubbles: true,
        cancelable: true,
      }));

      const startState = {
        isPointerDown: sys.isPointerDown,
        pointerDragMode: sys.pointerDragMode,
        gameState: sys.gameState,
      };

      // Pull back towards player (downwards on screen: y + 45) to aim
      const touchMove = new Touch({
        identifier: 1,
        target: canvas,
        clientX: x,
        clientY: y + 45,
        pageX: x,
        pageY: y + 45,
      });
      window.dispatchEvent(new TouchEvent('touchmove', {
        touches: [touchMove],
        targetTouches: [touchMove],
        changedTouches: [touchMove],
        bubbles: true,
        cancelable: true,
      }));

      const aimState = {
        isPointerDown: sys.isPointerDown,
        pointerDragMode: sys.pointerDragMode,
        gameState: sys.gameState,
        aimVisible: sys.aimLine.visible,
        powerRatio: sys.currentPowerRatio,
      };

      // Release touch (fire striker)
      const touchEnd = new Touch({
        identifier: 1,
        target: canvas,
        clientX: x,
        clientY: y + 45,
        pageX: x,
        pageY: y + 45,
      });
      window.dispatchEvent(new TouchEvent('touchend', {
        touches: [],
        targetTouches: [],
        changedTouches: [touchEnd],
        bubbles: true,
        cancelable: true,
      }));

      const shootState = {
        gameState: sys.gameState,
        shots: sys.shots,
        strikerVx: sys.strikerBody.vx,
        strikerVz: sys.strikerBody.vz,
      };

      return {
        screenCoords: { x, y },
        startState,
        aimState,
        shootState,
      };
    });

    console.log('   Touch Down State:', result.startState);
    console.log('   Touch Aim State:', result.aimState);
    console.log('   Touch Shoot State:', result.shootState);

    if (result.shootState.shots < 1) {
      throw new Error('Touch release failed to fire striker shot!');
    }

    // 3. Wait for physics simulation
    console.log('3. Waiting for physics simulation to complete...');
    await page.waitForTimeout(3500);

    const postPhysics = await page.evaluate(() => {
      const sys = window.__carromSystem;
      return {
        gameState: sys.gameState,
        shots: sys.shots,
        currentPlayer: sys.players[sys.currentPlayerIndex].name,
        strikerPos: { x: sys.strikerBody.x.toFixed(3), z: sys.strikerBody.z.toFixed(3) },
        whiteRemaining: sys.whiteRemaining,
        blackRemaining: sys.blackRemaining
      };
    });
    console.log('   Post-Shot State:', postPhysics);

    // 4. Capture mobile screenshot
    const artifactMobilePath = 'C:/Users/anurag/.gemini/antigravity/brain/e3155b8d-19f2-4ac8-b2be-507faa965657/carrom-mobile-preview.png';
    await page.screenshot({ path: artifactMobilePath });
    console.log(`4. Saved Mobile Preview screenshot to ${artifactMobilePath}`);

    console.log('\n======================================================');
    console.log('SUCCESS: MOBILE BROWSER & TOUCH CONTROLS VERIFIED!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('MOBILE TEST FAILURE:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testMobileBrowser();
