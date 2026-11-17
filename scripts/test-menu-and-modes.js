/**
 * Comprehensive verification of the improved CARROM CLASH Main Menu,
 * Play Alone (Solo Practice & VS AI Bot), Play with Friends (1, 2, 3 Friends local pass-and-play),
 * Settings, and turn transition screens.
 */
import { chromium } from 'playwright';

async function testMenuAndModes() {
  console.log('--- STARTING CARROM CLASH MENU & MODES AUDIT ---');
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--use-gl=swiftshader']
  });

  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  });

  try {
    console.log('1. Connecting to CARROM CLASH dev server...');
    await page.goto('https://localhost:8081/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);

    // Wait for CarromSystem initialization
    console.log('2. Waiting for __carromSystem...');
    await page.waitForFunction(() => !!window.__carromSystem, { timeout: 15000 });

    // Step A: Inspect Main Start Screen
    console.log('3. Inspecting Main Start Screen...');
    const mainState = await page.evaluate(() => {
      const sys = window.__carromSystem;
      return {
        currentView: sys.currentView,
        hasAloneBtn: !!sys.panelAsset.getElementById('btn-play-alone'),
        hasFriendsBtn: !!sys.panelAsset.getElementById('btn-play-friends'),
        hasSettingsBtn: !!sys.panelAsset.getElementById('btn-settings'),
      };
    });
    console.log('   Main Menu State:', mainState);
    if (mainState.currentView !== 'MAIN_MENU' || !mainState.hasAloneBtn || !mainState.hasFriendsBtn || !mainState.hasSettingsBtn) {
      throw new Error(`Main menu missing required elements: ${JSON.stringify(mainState)}`);
    }

    const artifactMenuPath = 'C:/Users/anurag/.gemini/antigravity/brain/e3155b8d-19f2-4ac8-b2be-507faa965657/carrom-menu-main.png';
    await page.screenshot({ path: artifactMenuPath });
    console.log(`   Saved Main Menu screenshot to ${artifactMenuPath}`);

    // Step B: Inspect PLAY ALONE menu
    console.log('4. Navigating to PLAY ALONE menu...');
    const aloneState = await page.evaluate(() => {
      const sys = window.__carromSystem;
      sys.showView('ALONE_MENU');
      return {
        currentView: sys.currentView,
        hasSoloPracticeBtn: !!sys.panelAsset.getElementById('btn-alone-practice'),
        hasAIBtn: !!sys.panelAsset.getElementById('btn-alone-ai'),
        hasBackBtn: !!sys.panelAsset.getElementById('btn-alone-back'),
      };
    });
    console.log('   Alone Menu State:', aloneState);
    if (aloneState.currentView !== 'ALONE_MENU' || !aloneState.hasSoloPracticeBtn || !aloneState.hasAIBtn) {
      throw new Error(`Alone menu missing required options: ${JSON.stringify(aloneState)}`);
    }

    const artifactAlonePath = 'C:/Users/anurag/.gemini/antigravity/brain/e3155b8d-19f2-4ac8-b2be-507faa965657/carrom-menu-alone.png';
    await page.screenshot({ path: artifactAlonePath });
    console.log(`   Saved Play Alone screenshot to ${artifactAlonePath}`);

    // Step C: Test Play Alone -> Solo Practice
    console.log('5. Testing Solo Practice mode...');
    const soloRes = await page.evaluate(() => {
      const sys = window.__carromSystem;
      sys.startSoloMode();
      return {
        currentView: sys.currentView,
        gameMode: sys.gameMode,
        numPlayers: sys.numPlayers,
        p1Name: sys.players[0].name,
      };
    });
    console.log('   Solo Mode Running:', soloRes);
    if (soloRes.currentView !== 'GAMEPLAY' || soloRes.gameMode !== 'SOLO' || soloRes.numPlayers !== 1) {
      throw new Error(`Solo mode failed: ${JSON.stringify(soloRes)}`);
    }

    // Step D: Test Play Alone -> VS Computer AI
    console.log('6. Testing VS Computer AI mode...');
    const aiStartRes = await page.evaluate(() => {
      const sys = window.__carromSystem;
      sys.startVsAIMode();
      return {
        currentView: sys.currentView,
        gameMode: sys.gameMode,
        numPlayers: sys.numPlayers,
        p1Name: sys.players[0].name,
        p2Name: sys.players[1].name,
      };
    });
    console.log('   VS AI Match Announcement:', aiStartRes);
    if (aiStartRes.currentView !== 'MATCH_ANNOUNCEMENT' || aiStartRes.gameMode !== 'VS_AI' || aiStartRes.p2Name !== 'AI Bot') {
      throw new Error(`VS AI mode failed to announce match: ${JSON.stringify(aiStartRes)}`);
    }

    // Transition to gameplay
    await page.evaluate(() => {
      const sys = window.__carromSystem;
      sys.showView('GAMEPLAY');
      sys.gameState = 'READY';
      sys.updateUI();
    });

    // Player 1 fires shot without potting -> Turn passes to AI Bot
    console.log('7. Player 1 miss strike -> handing turn to AI Bot...');
    await page.evaluate(() => {
      const sys = window.__carromSystem;
      sys.fireShot(0, -0.05, 0.2);
    });
    await page.waitForTimeout(2000);

    const aiTurnState = await page.evaluate(() => {
      const sys = window.__carromSystem;
      return {
        currentPlayerIndex: sys.currentPlayerIndex,
        currentPlayer: sys.getCurrentPlayer().name,
        aiThinkingTimer: sys.aiThinkingTimer,
        currentView: sys.currentView,
      };
    });
    console.log('   AI Bot Active on Turn:', aiTurnState);
    if (aiTurnState.currentPlayerIndex !== 1 || aiTurnState.currentPlayer !== 'AI Bot') {
      throw new Error(`AI Bot did not receive turn: ${JSON.stringify(aiTurnState)}`);
    }

    // Wait for AI to execute its shot
    console.log('8. Waiting for AI Bot to calculate and execute shot...');
    await page.waitForTimeout(2500);

    const postAIShotState = await page.evaluate(() => {
      const sys = window.__carromSystem;
      return {
        shots: sys.shots,
        gameState: sys.gameState,
      };
    });
    console.log('   After AI Shot executed:', postAIShotState);
    if (postAIShotState.shots < 2) {
      throw new Error(`AI Bot failed to take shot! Shots count: ${postAIShotState.shots}`);
    }

    // Step E: Inspect PLAY WITH FRIENDS menu
    console.log('9. Navigating to PLAY WITH FRIENDS menu...');
    const friendsState = await page.evaluate(() => {
      const sys = window.__carromSystem;
      sys.showView('FRIENDS_MENU');
      return {
        currentView: sys.currentView,
        hasP2Btn: !!sys.panelAsset.getElementById('btn-players-2'),
        hasP3Btn: !!sys.panelAsset.getElementById('btn-players-3'),
        hasP4Btn: !!sys.panelAsset.getElementById('btn-players-4'),
        hasBackBtn: !!sys.panelAsset.getElementById('btn-friends-back'),
      };
    });
    console.log('   Friends Menu State:', friendsState);
    if (friendsState.currentView !== 'FRIENDS_MENU' || !friendsState.hasP2Btn || !friendsState.hasP3Btn || !friendsState.hasP4Btn) {
      throw new Error(`Friends menu missing options: ${JSON.stringify(friendsState)}`);
    }

    const artifactFriendsPath = 'C:/Users/anurag/.gemini/antigravity/brain/e3155b8d-19f2-4ac8-b2be-507faa965657/carrom-menu-friends.png';
    await page.screenshot({ path: artifactFriendsPath });
    console.log(`   Saved Friends Menu screenshot to ${artifactFriendsPath}`);

    // Step F: Test 1 Friend (2 Players total) Pass & Play
    console.log('10. Starting 1 Friend (2 Players total) Pass-and-Play...');
    await page.evaluate(() => {
      const sys = window.__carromSystem;
      sys.startPassAndPlay(2);
      sys.showView('GAMEPLAY');
      sys.gameState = 'READY';
      sys.updateUI();
    });

    // P1 fires miss shot -> Transition screen appears
    console.log('11. Simulating turn handover to Player 2...');
    await page.evaluate(() => {
      const sys = window.__carromSystem;
      sys.fireShot(0, -0.05, 0.2);
    });
    await page.waitForTimeout(2000);

    const transitionState = await page.evaluate(() => {
      const sys = window.__carromSystem;
      return {
        currentView: sys.currentView,
        currentPlayerIndex: sys.currentPlayerIndex,
        currentPlayer: sys.getCurrentPlayer().name,
        passText: sys.passInstructionElem ? sys.passInstructionElem.properties.children : null,
      };
    });
    console.log('   Transition Screen Verified:', transitionState);
    if (transitionState.currentView !== 'TURN_PASS' || transitionState.currentPlayerIndex !== 1) {
      throw new Error(`Turn handover modal failed: ${JSON.stringify(transitionState)}`);
    }

    const artifactPassPath = 'C:/Users/anurag/.gemini/antigravity/brain/e3155b8d-19f2-4ac8-b2be-507faa965657/carrom-turn-pass-screen.png';
    await page.screenshot({ path: artifactPassPath });
    console.log(`   Saved Turn Pass Transition screenshot to ${artifactPassPath}`);

    // Step G: Test SETTINGS Menu
    console.log('12. Navigating to SETTINGS menu...');
    const settingsState = await page.evaluate(() => {
      const sys = window.__carromSystem;
      sys.showView('SETTINGS');
      return {
        currentView: sys.currentView,
        hasSoundBtn: !!sys.panelAsset.getElementById('btn-toggle-sound'),
        hasAimBtn: !!sys.panelAsset.getElementById('btn-toggle-aim'),
        hasCamBtn: !!sys.panelAsset.getElementById('btn-toggle-cam'),
        hasBackBtn: !!sys.panelAsset.getElementById('btn-settings-back'),
      };
    });
    console.log('   Settings Menu State:', settingsState);
    if (settingsState.currentView !== 'SETTINGS' || !settingsState.hasSoundBtn || !settingsState.hasAimBtn || !settingsState.hasCamBtn) {
      throw new Error(`Settings menu missing options: ${JSON.stringify(settingsState)}`);
    }

    const artifactSettingsPath = 'C:/Users/anurag/.gemini/antigravity/brain/e3155b8d-19f2-4ac8-b2be-507faa965657/carrom-menu-settings.png';
    await page.screenshot({ path: artifactSettingsPath });
    console.log(`   Saved Settings screenshot to ${artifactSettingsPath}`);

    // Return to main menu
    console.log('13. Returning to Main Menu...');
    await page.evaluate(() => {
      const sys = window.__carromSystem;
      sys.showView('MAIN_MENU');
    });

    console.log('\n======================================================');
    console.log('SUCCESS: ALL MENU, MODES & AI AUDIT TESTS PASSED!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('TEST RUNTIME FAILURE:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testMenuAndModes();
