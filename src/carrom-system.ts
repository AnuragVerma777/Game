/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * CARROM CLASH — Tournament Edition Multi-Screen Pass-and-Play System
 * Features:
 * - Deterministic 2D planar physics synchronization
 * - Procedural physical audio (wood impacts, coin collisions, pocket drops, fouls, victory)
 * - Natural VR hand tracking with continuous pinch strength and fingertip reticle
 * - Dynamic visual power indicator and aiming guide on the board
 * - Desktop mouse and mobile responsive touch controls
 * - Multi-screen spatial UI (Main Menu, Friends Menu, Settings, Gameplay, Turn Pass, Game Over)
 * - Turn-by-turn Local Pass-and-Play (2, 3, 4 players) with extra strikes and fouls
 * - Solo practice mode with restart and score tracking
 */

import {
  BufferGeometry,
  createSystem,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
  UIKitMLAsset,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { carromAudio } from './audio/carrom-audio.js';
import { CarromPiece } from './carrom-component.js';
import {
  CarromBody,
  CarromPhysicsWorld,
  PocketEvent,
} from './physics/carrom-physics.js';

type GameState = 'READY' | 'AIMING' | 'SIMULATING' | 'COMPLETED';
type ViewScreen =
  | 'MAIN_MENU'
  | 'ALONE_MENU'
  | 'FRIENDS_MENU'
  | 'SETTINGS'
  | 'MATCH_ANNOUNCEMENT'
  | 'GAMEPLAY'
  | 'TURN_PASS'
  | 'GAME_OVER';

interface PlayerInfo {
  id: number;
  name: string;
  score: number;
  colorHex: number;
  colorName: string;
}

export class CarromSystem extends createSystem({
  pieces: { required: [CarromPiece] },
}) {
  private physicsWorld = new CarromPhysicsWorld();
  private entityBodyMap = new Map<string, { body: CarromBody; mesh: any }>();
  private strikerBody: CarromBody | null = null;
  private strikerMesh: any = null;

  // View state
  private currentView: ViewScreen = 'MAIN_MENU';

  // Game mode & Player state
  private gameMode: 'SOLO' | 'PASS_AND_PLAY' | 'VS_AI' = 'SOLO';
  private numPlayers = 1;
  private currentPlayerIndex = 0;
  private aiThinkingTimer = 0;
  private players: PlayerInfo[] = [
    { id: 1, name: 'Player 1', score: 0, colorHex: 0xffd700, colorName: 'GOLD' },
    { id: 2, name: 'Player 2', score: 0, colorHex: 0x00d2d3, colorName: 'CYAN' },
    { id: 3, name: 'Player 3', score: 0, colorHex: 0x2ecc71, colorName: 'GREEN' },
    { id: 4, name: 'Player 4', score: 0, colorHex: 0x9b59b6, colorName: 'PURPLE' },
  ];

  // Per-turn state
  private coinsPottedInTurn = 0;
  private foulInTurn = false;
  private hasExtraStrike = false;

  // Match stats
  private gameState: GameState = 'READY';
  private shots = 0;
  private whiteRemaining = 9;
  private blackRemaining = 9;
  private queenPocketed = false;
  private lastFoulNotice = false;

  // Settings
  private aimTrajectoryFull = true;

  // Board metrics
  private readonly baselineZ = -0.41;
  private readonly boardSurfaceY = 0.754;
  private readonly maxPullDistance = 0.15;
  private readonly maxShotSpeed = 3.6;

  // Desktop / Mobile pointer state
  private isPointerDown = false;
  private pointerDragMode: 'NONE' | 'SLIDING' | 'AIMING' = 'NONE';
  private strikerAnchorX = 0;
  private pullVector = new Vector3();
  private shotDir = new Vector3(0, 0, -1);
  private rayOrigin = new Vector3();
  private rayDirection = new Vector3();
  private planePoint = new Vector3();
  private currentPowerRatio = 0;

  // 3D Angled Camera & Smooth Orbit / Zoom State
  private camTarget = new Vector3(0, 0.754, -0.65);
  private camDesiredDistance = 1.15;
  private camCurrentDistance = 1.15;
  private camDesiredAzimuth = 0;
  private camCurrentAzimuth = 0;
  private camDesiredElevation = 0.58; // ~34 degrees angled down
  private camCurrentElevation = 0.58;
  private isCameraRotating = false;
  private lastMousePos = { x: 0, y: 0 };
  private touchInitialDist = 0;

  // VR Hand Tracking state
  private isVRHandGrabbed = false;
  private vrActiveHand: 'left' | 'right' = 'right';
  private handWorldPos = {
    left: new Vector3(),
    right: new Vector3(),
  };

  // Visual Aim, Power & Hand Feedback
  private aimGroup!: Group;
  private aimLineGeo!: BufferGeometry;
  private aimLine!: Line;
  private aimTargetMesh!: Mesh;
  private handIndicatorMesh!: Mesh;
  private strikerHaloMesh!: Mesh;
  private powerArcMesh!: Mesh;

  // Spatial UI elements
  private panelAsset: UIKitMLAsset | null | undefined = null;
  private viewMainMenu: any = null;
  private viewAloneMenu: any = null;
  private viewFriendsMenu: any = null;
  private viewSettingsMenu: any = null;
  private viewMatchAnnouncement: any = null;
  private viewGameplay: any = null;
  private viewTurnPass: any = null;
  private viewGameOver: any = null;
  private brandHeaderElem: any = null;

  private matchAnnouncementTitleElem: any = null;
  private matchAnnouncementSubElem: any = null;
  private turnTitleElem: any = null;
  private turnExtraElem: any = null;
  private turnQueenCoverElem: any = null;
  private passInstructionElem: any = null;
  private winnerBannerElem: any = null;
  private finalScoresElem: any = null;
  private soundStatusElem: any = null;
  private aimStatusElem: any = null;
  private camStatusElem: any = null;

  // Tournament Queen Cover & Due Piece State
  private queenCoverState: 'NONE' | 'NEEDS_COVER' = 'NONE';
  private queenCoverPlayerIndex = -1;
  private queenPottedThisStrike = false;

  private p1ScoreElem: any = null;
  private p2ScoreElem: any = null;
  private p3ScoreElem: any = null;
  private p4ScoreElem: any = null;
  private p1CardElem: any = null;
  private p2CardElem: any = null;
  private p3CardElem: any = null;
  private p4CardElem: any = null;

  private shotsElem: any = null;
  private statusElem: any = null;
  private whiteElem: any = null;
  private blackElem: any = null;
  private queenElem: any = null;
  private powerElem: any = null;

  private btnMenuBack: any = null;
  private btnResetRack: any = null;
  private btnXr: any = null;
  private btnExitXr: any = null;

  init(): void {
    if (typeof window !== 'undefined') {
      (window as any).__carromSystem = this;
    }

    // 1. Build Physics Bodies from Scene Entities
    for (const entity of this.queries.pieces.entities) {
      const obj = entity.object3D;
      if (!obj) continue;

      const pieceType = entity.getValue(CarromPiece, 'pieceType') as
        | 'striker'
        | 'queen'
        | 'white'
        | 'black';

      const isStriker = pieceType === 'striker';
      const radius = isStriker ? 0.02065 : 0.0159;
      const mass = isStriker ? 3.0 : 1.0;

      const body: CarromBody = {
        id: obj.name || `piece_${Math.random()}`,
        type: pieceType,
        x: obj.position.x,
        z: obj.position.z,
        vx: 0,
        vz: 0,
        radius,
        mass,
        active: true,
        pocketed: false,
      };

      this.physicsWorld.addBody(body);
      this.entityBodyMap.set(body.id, { body, mesh: obj });

      if (isStriker) {
        this.strikerBody = body;
        this.strikerMesh = obj;
      }
    }

    // 2. Physics & Procedural Audio Callbacks
    this.physicsWorld.onPocketed = (event: PocketEvent) => {
      this.handlePocketed(event);
    };

    this.physicsWorld.onCollision = (_b1, _b2, impulse) => {
      carromAudio.playCollision(impulse);
    };

    // 3. Setup Visual Indicators (Aim guide, Power Arc, Hand Reticle)
    this.setupVisualFeedback();

    // 4. Setup Desktop Mouse & Mobile Touch Handlers
    this.setupPointerInputs();

    // 5. Setup Spatial UI Panel with Multi-screen Navigation
    this.setupUIPanel();
  }

  private setupVisualFeedback(): void {
    this.aimGroup = new Group();
    this.aimGroup.name = 'AimAndHandVisualGroup';

    // A. Aiming Trajectory Line
    const linePositions = new Float32Array([0, 0, 0, 0, 0, -0.1]);
    this.aimLineGeo = new BufferGeometry();
    this.aimLineGeo.setAttribute(
      'position',
      new Float32BufferAttribute(linePositions, 3),
    );

    const lineMat = new LineBasicMaterial({
      color: 0xffd700,
      linewidth: 3,
      depthTest: false,
    });
    this.aimLine = new Line(this.aimLineGeo, lineMat);
    this.aimLine.renderOrder = 999;
    this.aimLine.visible = false;

    // B. Target Reticle at line end
    const ringGeo = new RingGeometry(0.008, 0.013, 24);
    const ringMat = new MeshBasicMaterial({
      color: 0xffd700,
      depthTest: false,
    });
    this.aimTargetMesh = new Mesh(ringGeo, ringMat);
    this.aimTargetMesh.rotation.x = -Math.PI / 2;
    this.aimTargetMesh.renderOrder = 999;
    this.aimTargetMesh.visible = false;

    // C. Striker Selection Halo
    const haloGeo = new RingGeometry(0.0215, 0.028, 32);
    const haloMat = new MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.7,
      depthTest: false,
    });
    this.strikerHaloMesh = new Mesh(haloGeo, haloMat);
    this.strikerHaloMesh.rotation.x = -Math.PI / 2;
    this.strikerHaloMesh.position.set(0, this.boardSurfaceY + 0.001, this.baselineZ);
    this.strikerHaloMesh.renderOrder = 998;

    // D. On-Board Shot Power Arc (Behind Striker)
    const powerGeo = new RingGeometry(0.032, 0.038, 32, 1, Math.PI * 0.1, Math.PI * 0.8);
    const powerMat = new MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.85,
      depthTest: false,
    });
    this.powerArcMesh = new Mesh(powerGeo, powerMat);
    this.powerArcMesh.rotation.x = -Math.PI / 2;
    this.powerArcMesh.position.set(0, this.boardSurfaceY + 0.0012, this.baselineZ);
    this.powerArcMesh.renderOrder = 999;
    this.powerArcMesh.visible = false;

    // E. VR Hand Fingertip Pinch Reticle
    const fingerGeo = new SphereGeometry(0.009, 16, 16);
    const fingerMat = new MeshBasicMaterial({
      color: 0x00d2d3,
      transparent: true,
      opacity: 0.75,
      depthTest: false,
    });
    this.handIndicatorMesh = new Mesh(fingerGeo, fingerMat);
    this.handIndicatorMesh.visible = false;
    this.handIndicatorMesh.renderOrder = 1000;

    this.aimGroup.add(
      this.aimLine,
      this.aimTargetMesh,
      this.strikerHaloMesh,
      this.powerArcMesh,
      this.handIndicatorMesh,
    );
    this.scene.add(this.aimGroup);

    this.cleanupFuncs.push(() => {
      this.scene.remove(this.aimGroup);
      this.aimLineGeo.dispose();
      lineMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      haloGeo.dispose();
      haloMat.dispose();
      powerGeo.dispose();
      powerMat.dispose();
      fingerGeo.dispose();
      fingerMat.dispose();
    });
  }

  private setupPointerInputs(): void {
    const dom = this.renderer.domElement;

    // Desktop Mouse Handlers
    const onMouseDown = (e: MouseEvent) => {
      if (this.isImmersiveXR()) return;
      carromAudio.ensureContext();

      // Right-click (2), middle-click (1), or Shift-click -> Orbit Camera
      if (e.button === 2 || e.button === 1 || e.shiftKey) {
        e.preventDefault();
        this.isCameraRotating = true;
        this.lastMousePos.x = e.clientX;
        this.lastMousePos.y = e.clientY;
        return;
      }

      // Left-click on striker or baseline -> Striker Interaction
      const hit = this.getBoardIntersection(e.clientX, e.clientY);
      const isNearBaseline = hit && Math.abs(hit.z - this.baselineZ) < 0.065;
      const distToStriker =
        hit && this.strikerBody
          ? Math.hypot(hit.x - this.strikerBody.x, hit.z - this.strikerBody.z)
          : 999;

      if (isNearBaseline || distToStriker < 0.06) {
        this.handlePointerStart(e.clientX, e.clientY);
      } else if (this.currentView === 'GAMEPLAY') {
        // Clicked outside board during GAMEPLAY -> Orbit Camera smoothly
        this.isCameraRotating = true;
        this.lastMousePos.x = e.clientX;
        this.lastMousePos.y = e.clientY;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (this.isImmersiveXR()) return;

      if (this.isCameraRotating) {
        const dx = e.clientX - this.lastMousePos.x;
        const dy = e.clientY - this.lastMousePos.y;
        this.lastMousePos.x = e.clientX;
        this.lastMousePos.y = e.clientY;

        this.camDesiredAzimuth -= dx * 0.0055;
        this.camDesiredElevation = Math.max(
          0.18,
          Math.min(1.48, this.camDesiredElevation + dy * 0.0045),
        );
        return;
      }

      this.handlePointerMove(e.clientX, e.clientY);
    };

    const onMouseUp = () => {
      if (this.isImmersiveXR()) return;
      if (this.isCameraRotating) {
        this.isCameraRotating = false;
      }
      this.handlePointerEnd();
    };

    const onWheel = (e: WheelEvent) => {
      if (this.isImmersiveXR()) return;
      e.preventDefault();
      this.camDesiredDistance = Math.max(
        0.52,
        Math.min(1.50, this.camDesiredDistance + e.deltaY * 0.0012),
      );
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Mobile Responsive Touch Handlers (Single-touch play & Two-finger orbit/pinch)
    const onTouchStart = (e: TouchEvent) => {
      if (this.isImmersiveXR() || e.touches.length === 0) return;
      carromAudio.ensureContext();

      if (e.touches.length === 2) {
        // Two-finger pinch & rotate
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        this.touchInitialDist = Math.hypot(
          t2.clientX - t1.clientX,
          t2.clientY - t1.clientY,
        );
        this.lastMousePos.x = (t1.clientX + t2.clientX) / 2;
        this.lastMousePos.y = (t1.clientY + t2.clientY) / 2;
        this.isCameraRotating = true;
        return;
      }

      // Single-finger touch
      const t = e.touches[0];
      const hit = this.getBoardIntersection(t.clientX, t.clientY);
      const isNearBaseline = hit && Math.abs(hit.z - this.baselineZ) < 0.075;
      const distToStriker =
        hit && this.strikerBody
          ? Math.hypot(hit.x - this.strikerBody.x, hit.z - this.strikerBody.z)
          : 999;

      if (isNearBaseline || distToStriker < 0.07) {
        e.preventDefault();
        this.handlePointerStart(t.clientX, t.clientY);
      } else {
        this.isCameraRotating = true;
        this.lastMousePos.x = t.clientX;
        this.lastMousePos.y = t.clientY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (this.isImmersiveXR() || e.touches.length === 0) return;

      if (e.touches.length === 2 && this.isCameraRotating) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const newDist = Math.hypot(
          t2.clientX - t1.clientX,
          t2.clientY - t1.clientY,
        );
        const distDelta = this.touchInitialDist - newDist;
        this.touchInitialDist = newDist;
        this.camDesiredDistance = Math.max(
          0.52,
          Math.min(1.50, this.camDesiredDistance + distDelta * 0.002),
        );

        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;
        const dx = midX - this.lastMousePos.x;
        const dy = midY - this.lastMousePos.y;
        this.lastMousePos.x = midX;
        this.lastMousePos.y = midY;

        this.camDesiredAzimuth -= dx * 0.0055;
        this.camDesiredElevation = Math.max(
          0.18,
          Math.min(1.48, this.camDesiredElevation + dy * 0.0045),
        );
        return;
      }

      if (this.isCameraRotating) {
        const t = e.touches[0];
        const dx = t.clientX - this.lastMousePos.x;
        const dy = t.clientY - this.lastMousePos.y;
        this.lastMousePos.x = t.clientX;
        this.lastMousePos.y = t.clientY;

        this.camDesiredAzimuth -= dx * 0.0055;
        this.camDesiredElevation = Math.max(
          0.18,
          Math.min(1.48, this.camDesiredElevation + dy * 0.0045),
        );
        return;
      }

      e.preventDefault();
      const t = e.touches[0];
      this.handlePointerMove(t.clientX, t.clientY);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (this.isImmersiveXR()) return;
      if (this.isCameraRotating) this.isCameraRotating = false;
      this.handlePointerEnd();
    };

    // Keyboard controls (A/D to slide, Space/Enter to strike/start, R to re-rack, C to toggle view, 1-4 for menus, Esc/M for menu)
    const onKeyDown = (e: KeyboardEvent) => {
      carromAudio.ensureContext();

      if (e.code === 'KeyC') {
        // Toggle Angled 3D view vs Top-Down Strategic view
        if (this.camDesiredElevation > 1.1) {
          this.camDesiredElevation = 0.58; // Angled 3D
          this.camDesiredDistance = 1.15;
          this.camDesiredAzimuth = 0;
        } else {
          this.camDesiredElevation = 1.45; // Top-Down
          this.camDesiredDistance = 0.85;
          this.camDesiredAzimuth = 0;
        }
        return;
      } else if (e.code === 'KeyV' || e.code === 'Digit0') {
        // Reset to default Angled 3D Broadcast View
        this.camDesiredElevation = 0.58;
        this.camDesiredDistance = 1.15;
        this.camDesiredAzimuth = 0;
        return;
      }

      // Universal Menu Navigation Keys
      if (e.code === 'Escape' || e.code === 'KeyM') {
        this.showView('MAIN_MENU');
        return;
      }

      if (this.currentView === 'MAIN_MENU') {
        if (e.code === 'Digit1' || e.code === 'Numpad1') {
          this.showView('ALONE_MENU');
        } else if (e.code === 'Digit2' || e.code === 'Numpad2') {
          this.showView('FRIENDS_MENU');
        } else if (e.code === 'Digit3' || e.code === 'Numpad3') {
          this.showView('SETTINGS');
        } else if (e.code === 'Space' || e.code === 'Enter') {
          this.startSoloMode();
        }
        return;
      } else if (this.currentView === 'ALONE_MENU') {
        if (e.code === 'Digit1' || e.code === 'Numpad1' || e.code === 'Space' || e.code === 'Enter') {
          this.startSoloMode();
        } else if (e.code === 'Digit2' || e.code === 'Numpad2') {
          this.startVsAIMode();
        } else if (e.code === 'KeyB') {
          this.showView('MAIN_MENU');
        }
        return;
      } else if (this.currentView === 'FRIENDS_MENU') {
        if (e.code === 'Digit2' || e.code === 'Numpad2') {
          this.startPassAndPlay(2);
        } else if (e.code === 'Digit3' || e.code === 'Numpad3') {
          this.startPassAndPlay(3);
        } else if (e.code === 'Digit4' || e.code === 'Numpad4') {
          this.startPassAndPlay(4);
        } else if (e.code === 'KeyB') {
          this.showView('MAIN_MENU');
        }
        return;
      } else if (this.currentView === 'MATCH_ANNOUNCEMENT') {
        if (e.code === 'Space' || e.code === 'Enter') {
          this.showView('GAMEPLAY');
          this.gameState = 'READY';
          this.updateUI();
        }
        return;
      } else if (this.currentView === 'TURN_PASS') {
        if (e.code === 'Space' || e.code === 'Enter') {
          this.showView('GAMEPLAY');
          this.gameState = 'READY';
          this.updateUI();
        }
        return;
      } else if (this.currentView === 'GAME_OVER') {
        if (e.code === 'Space' || e.code === 'Enter') {
          if (this.gameMode === 'PASS_AND_PLAY') {
            this.startPassAndPlay(this.numPlayers as 2 | 3 | 4);
          } else if (this.gameMode === 'VS_AI') {
            this.startVsAIMode();
          } else {
            this.startSoloMode();
          }
        }
        return;
      }

      if (this.currentView !== 'GAMEPLAY') return;
      if (this.gameState !== 'READY' || !this.strikerBody) return;
      if (this.gameMode === 'VS_AI' && this.currentPlayerIndex === 1) return;

      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        const newX = Math.max(-0.21, this.strikerBody.x - 0.015);
        this.setStrikerBaselineX(newX);
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        const newX = Math.min(0.21, this.strikerBody.x + 0.015);
        this.setStrikerBaselineX(newX);
      } else if (e.code === 'Space' || e.code === 'Enter') {
        this.fireShot(0, -2.6, 0.7);
      } else if (e.code === 'KeyR') {
        this.resetRack();
      }
    };

    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('contextmenu', onContextMenu);

    dom.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: false });

    window.addEventListener('keydown', onKeyDown);

    this.cleanupFuncs.push(() => {
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('contextmenu', onContextMenu);

      dom.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);

      window.removeEventListener('keydown', onKeyDown);
    });
  }

  private isImmersiveXR(): boolean {
    return this.world.visibilityState.value !== VisibilityState.NonImmersive;
  }

  private handlePointerStart(clientX: number, clientY: number): void {
    if (this.currentView !== 'GAMEPLAY') return;
    if (this.gameState !== 'READY' || !this.strikerBody) return;
    if (this.gameMode === 'VS_AI' && this.currentPlayerIndex === 1) return;
    const hit = this.getBoardIntersection(clientX, clientY);
    if (!hit) return;

    const distToStriker = Math.hypot(
      hit.x - this.strikerBody.x,
      hit.z - this.strikerBody.z,
    );
    const distToBaseline = Math.abs(hit.z - this.baselineZ);

    // If clicked along the baseline or near the striker
    if (distToBaseline < 0.065 || distToStriker < 0.06) {
      this.isPointerDown = true;
      this.lastFoulNotice = false;

      // If clicked far from striker along the baseline, snap immediately
      if (distToStriker > 0.045 && distToBaseline < 0.055) {
        const clampedX = Math.max(-0.21, Math.min(0.21, hit.x));
        this.setStrikerBaselineX(clampedX);
      }

      this.strikerAnchorX = this.strikerBody.x;
      this.pointerDragMode = 'SLIDING';
    }
  }

  private handlePointerMove(clientX: number, clientY: number): void {
    if (!this.isPointerDown || this.pointerDragMode === 'NONE') return;
    const hit = this.getBoardIntersection(clientX, clientY);
    if (!hit) return;

    if (this.pointerDragMode === 'SLIDING') {
      const deltaZ = hit.z - this.baselineZ;

      // If dragged backward beyond threshold, transition into AIMING!
      if (deltaZ > 0.015) {
        this.pointerDragMode = 'AIMING';
        this.gameState = 'AIMING';
        this.setAimGuideVisible(true);
        this.updateAimVector(hit.x, hit.z);
      } else {
        // Dragging horizontally along the legal baseline
        const clampedX = Math.max(-0.21, Math.min(0.21, hit.x));
        this.setStrikerBaselineX(clampedX);
        this.strikerAnchorX = clampedX;
      }
    } else if (this.pointerDragMode === 'AIMING') {
      this.updateAimVector(hit.x, hit.z);
    }
  }

  private handlePointerEnd(): void {
    if (!this.isPointerDown) return;
    this.isPointerDown = false;

    if (this.pointerDragMode === 'AIMING') {
      this.setAimGuideVisible(false);

      const pullDist = Math.hypot(this.pullVector.x, this.pullVector.z);
      if (pullDist > 0.015 && this.strikerBody) {
        const powerRatio = Math.min(1.0, pullDist / this.maxPullDistance);
        const speed = powerRatio * this.maxShotSpeed;
        this.fireShot(this.shotDir.x * speed, this.shotDir.z * speed, powerRatio);
      } else {
        this.gameState = 'READY';
        this.currentPowerRatio = 0;
        this.updateUI();
      }
    } else {
      // Finished sliding without shooting
      this.gameState = 'READY';
      this.currentPowerRatio = 0;
      this.updateUI();
    }

    this.pointerDragMode = 'NONE';
  }

  private setStrikerBaselineX(x: number): void {
    if (!this.strikerBody || !this.strikerMesh) return;
    this.strikerBody.x = x;
    this.strikerMesh.position.x = x;
    this.strikerHaloMesh.position.x = x;
    this.powerArcMesh.position.x = x;
  }

  private updateAimVector(targetX: number, targetZ: number): void {
    if (!this.strikerBody) return;

    this.pullVector.set(
      targetX - this.strikerAnchorX,
      0,
      targetZ - this.baselineZ,
    );

    const pullDist = Math.hypot(this.pullVector.x, this.pullVector.z);
    if (pullDist > 1e-4) {
      this.shotDir
        .set(-this.pullVector.x / pullDist, 0, -this.pullVector.z / pullDist)
        .normalize();
    } else {
      this.shotDir.set(0, 0, -1);
    }

    const clampedDist = Math.min(this.maxPullDistance, pullDist);
    this.currentPowerRatio = clampedDist / this.maxPullDistance;
    const lineLen = this.aimTrajectoryFull ? clampedDist * 2.8 : clampedDist * 1.4;

    const startX = this.strikerAnchorX;
    const startY = this.boardSurfaceY + 0.003;
    const startZ = this.baselineZ;
    const endX = startX + this.shotDir.x * lineLen;
    const endZ = startZ + this.shotDir.z * lineLen;

    const positions = (
      this.aimLineGeo.attributes.position as Float32BufferAttribute
    ).array as Float32Array;

    positions[0] = startX;
    positions[1] = startY;
    positions[2] = startZ;
    positions[3] = endX;
    positions[4] = startY;
    positions[5] = endZ;
    this.aimLineGeo.attributes.position.needsUpdate = true;

    this.aimTargetMesh.position.set(endX, startY, endZ);

    // Dynamic color gradient based on power and active player color
    const haloMat = this.strikerHaloMesh.material as MeshBasicMaterial;
    const powerMat = this.powerArcMesh.material as MeshBasicMaterial;

    let colHex = this.getCurrentPlayer().colorHex;
    if (this.currentPowerRatio > 0.72) {
      colHex = 0xff4757; // Blazing crimson
    } else if (this.currentPowerRatio > 0.38) {
      colHex = 0xffa502; // Warm amber
    }

    haloMat.color.setHex(colHex);
    powerMat.color.setHex(colHex);
    this.strikerHaloMesh.scale.setScalar(1.0 + this.currentPowerRatio * 0.35);

    this.updateUI();
  }

  private setAimGuideVisible(visible: boolean): void {
    this.aimLine.visible = visible;
    this.aimTargetMesh.visible = visible;
    this.powerArcMesh.visible = visible;

    if (!visible) {
      this.strikerHaloMesh.scale.set(1, 1, 1);
      (this.strikerHaloMesh.material as MeshBasicMaterial).color.setHex(
        this.getCurrentPlayer().colorHex,
      );
      this.currentPowerRatio = 0;
    }
  }

  private fireShot(vx: number, vz: number, powerRatio = 0.5): void {
    if (!this.strikerBody) return;
    carromAudio.playStrike(powerRatio);

    this.coinsPottedInTurn = 0;
    this.foulInTurn = false;
    this.hasExtraStrike = false;
    this.queenPottedThisStrike = false;

    this.strikerBody.vx = vx;
    this.strikerBody.vz = vz;
    this.shots++;
    this.gameState = 'SIMULATING';
    this.setAimGuideVisible(false);
    this.updateUI();
  }

  private getBoardIntersection(
    clientX: number,
    clientY: number,
  ): { x: number; z: number } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.planePoint.set(ndcX, ndcY, 0.5).unproject(this.camera);
    this.camera.getWorldPosition(this.rayOrigin);
    this.rayDirection.subVectors(this.planePoint, this.rayOrigin).normalize();

    if (Math.abs(this.rayDirection.y) < 1e-5) return null;
    const t = (this.boardSurfaceY - this.rayOrigin.y) / this.rayDirection.y;
    if (t < 0) return null;

    return {
      x: this.rayOrigin.x + this.rayDirection.x * t,
      z: this.rayOrigin.z + this.rayDirection.z * t,
    };
  }

  /**
   * Natural VR Hand Tracking & WebXR Hand Input Loop.
   */
  private processVRHandTracking(): void {
    if (!this.isImmersiveXR() || !this.strikerBody || this.currentView !== 'GAMEPLAY') {
      this.handIndicatorMesh.visible = false;
      return;
    }
    if (this.gameMode === 'VS_AI' && this.currentPlayerIndex === 1) {
      this.handIndicatorMesh.visible = false;
      return;
    }

    const hands: Array<'right' | 'left'> = ['right', 'left'];
    let bestHand: 'right' | 'left' = this.vrActiveHand;
    let closestDist = Infinity;

    for (const h of hands) {
      const tipGroup = this.player.indexTipSpaces[h];
      if (tipGroup) {
        tipGroup.getWorldPosition(this.handWorldPos[h]);
        const d = Math.hypot(
          this.handWorldPos[h].x - this.strikerBody.x,
          this.handWorldPos[h].z - this.strikerBody.z,
        );
        if (d < closestDist) {
          closestDist = d;
          bestHand = h;
        }
      }
    }

    this.vrActiveHand = bestHand;
    const activeHandPos = this.handWorldPos[this.vrActiveHand];
    const selectState = this.input.xr.getSelectState(this.vrActiveHand);

    const handAdapter = this.input.xr.visualAdapters.hand[this.vrActiveHand];
    const continuousPinch = handAdapter
      ? handAdapter.getPinchStrength()
      : selectState.active
        ? 1.0
        : 0.0;

    const isPinched = selectState.active || continuousPinch > 0.65;

    // Show visual hand fingertip reticle
    this.handIndicatorMesh.visible = true;
    this.handIndicatorMesh.position.copy(activeHandPos);

    const fingerMat = this.handIndicatorMesh.material as MeshBasicMaterial;
    fingerMat.color.setHex(isPinched ? 0xffd700 : 0x00d2d3);
    const indicatorScale = 1.0 - continuousPinch * 0.4;
    this.handIndicatorMesh.scale.setScalar(indicatorScale);

    const distToStriker = Math.hypot(
      activeHandPos.x - this.strikerBody.x,
      activeHandPos.z - this.strikerBody.z,
    );

    // Hover state
    if (this.gameState === 'READY') {
      const haloMat = this.strikerHaloMesh.material as MeshBasicMaterial;
      if (distToStriker < 0.12) {
        haloMat.opacity = 0.9;
        haloMat.color.setHex(isPinched ? 0xffd700 : this.getCurrentPlayer().colorHex);

        if (selectState.start || (isPinched && !this.isVRHandGrabbed)) {
          this.isVRHandGrabbed = true;
          this.gameState = 'AIMING';
          this.setAimGuideVisible(true);
          carromAudio.ensureContext();
        }
      } else {
        haloMat.opacity = 0.4;
        haloMat.color.setHex(this.getCurrentPlayer().colorHex);
      }
    }

    // VR Hand Grabbing / Aiming
    else if (this.gameState === 'AIMING' && this.isVRHandGrabbed) {
      const deltaZ = activeHandPos.z - this.baselineZ;

      if (deltaZ > 0.02) {
        this.updateAimVector(activeHandPos.x, activeHandPos.z);
      } else {
        const clampedX = Math.max(-0.21, Math.min(0.21, activeHandPos.x));
        this.setStrikerBaselineX(clampedX);
        this.updateAimVector(clampedX, this.baselineZ + 0.001);
      }

      // Pinch release -> Shoot!
      if (selectState.end || (!isPinched && continuousPinch < 0.28)) {
        this.isVRHandGrabbed = false;
        this.setAimGuideVisible(false);

        const pullDist = Math.hypot(this.pullVector.x, this.pullVector.z);
        if (pullDist > 0.02) {
          const powerRatio = Math.min(1.0, pullDist / this.maxPullDistance);
          const speed = powerRatio * this.maxShotSpeed;
          this.fireShot(this.shotDir.x * speed, this.shotDir.z * speed, powerRatio);
        } else {
          this.gameState = 'READY';
          this.currentPowerRatio = 0;
          this.updateUI();
        }
      }
    }
  }

  private handlePocketed(event: PocketEvent): void {
    const { body } = event;
    const player = this.getCurrentPlayer();

    if (body.type === 'white') {
      player.score += 10;
      this.coinsPottedInTurn++;
      this.whiteRemaining = Math.max(0, this.whiteRemaining - 1);
      carromAudio.playPocket(false);
    } else if (body.type === 'black') {
      player.score += 5;
      this.coinsPottedInTurn++;
      this.blackRemaining = Math.max(0, this.blackRemaining - 1);
      carromAudio.playPocket(false);
    } else if (body.type === 'queen') {
      this.coinsPottedInTurn++;
      this.queenPottedThisStrike = true;
      if (this.coinsPottedInTurn > 1) {
        // Covered in the same strike!
        player.score += 25;
        this.queenPocketed = true;
        this.queenCoverState = 'NONE';
        this.queenCoverPlayerIndex = -1;
      } else {
        // Must be covered on the next strike
        this.queenCoverState = 'NEEDS_COVER';
        this.queenCoverPlayerIndex = this.currentPlayerIndex;
      }
      carromAudio.playPocket(true);
    } else if (body.type === 'striker') {
      player.score = Math.max(0, player.score - 5);
      this.foulInTurn = true;
      this.lastFoulNotice = true;
      carromAudio.playFoul();
    }

    // Victory check: If all white & black pieces are pocketed
    if (this.whiteRemaining === 0 && this.blackRemaining === 0) {
      this.gameState = 'COMPLETED';
      carromAudio.playVictory();
    }

    this.updateUI();
  }

  private returnQueenToCenter(): void {
    for (const { body, mesh } of this.entityBodyMap.values()) {
      if (body.type === 'queen') {
        body.x = 0;
        body.z = -0.65;
        body.vx = 0;
        body.vz = 0;
        body.active = true;
        body.pocketed = false;

        if (mesh) {
          mesh.position.set(0, this.boardSurfaceY, -0.65);
          mesh.scale.set(1, 1, 1);
          mesh.visible = true;
        }
        this.queenPocketed = false;
        break;
      }
    }
  }

  private returnPenaltyCoin(): void {
    for (const { body, mesh } of this.entityBodyMap.values()) {
      if ((body.type === 'white' || body.type === 'black') && body.pocketed) {
        body.x = 0.038;
        body.z = -0.65;
        body.vx = 0;
        body.vz = 0;
        body.active = true;
        body.pocketed = false;

        if (mesh) {
          mesh.position.set(0.038, this.boardSurfaceY, -0.65);
          mesh.scale.set(1, 1, 1);
          mesh.visible = true;
        }

        if (body.type === 'white') {
          this.whiteRemaining++;
        } else {
          this.blackRemaining++;
        }
        break;
      }
    }
  }

  private getCurrentPlayer(): PlayerInfo {
    return this.players[this.currentPlayerIndex] || this.players[0];
  }

  private setupUIPanel(): void {
    this.panelAsset = this.world.getSceneObject<UIKitMLAsset>('carrom-panel');
    if (!this.panelAsset) return;

    // View Containers
    this.viewMainMenu = this.panelAsset.getElementById('view-main-menu');
    this.viewAloneMenu = this.panelAsset.getElementById('view-alone-menu');
    this.viewFriendsMenu = this.panelAsset.getElementById('view-friends-menu');
    this.viewSettingsMenu = this.panelAsset.getElementById('view-settings-menu');
    this.viewMatchAnnouncement = this.panelAsset.getElementById('view-match-announcement');
    this.viewGameplay = this.panelAsset.getElementById('view-gameplay');
    this.viewTurnPass = this.panelAsset.getElementById('view-turn-pass');
    this.viewGameOver = this.panelAsset.getElementById('view-game-over');
    this.brandHeaderElem = this.panelAsset.getElementById('panel-brand-header');

    // UI Dynamic Content Elements
    this.matchAnnouncementTitleElem = this.panelAsset.getElementById('match-announcement-title');
    this.matchAnnouncementSubElem = this.panelAsset.getElementById('match-announcement-subtitle');
    this.turnTitleElem = this.panelAsset.getElementById('turn-title');
    this.turnExtraElem = this.panelAsset.getElementById('turn-extra');
    this.turnQueenCoverElem = this.panelAsset.getElementById('turn-queen-cover');
    this.passInstructionElem = this.panelAsset.getElementById('pass-instruction');
    this.winnerBannerElem = this.panelAsset.getElementById('winner-banner');
    this.finalScoresElem = this.panelAsset.getElementById('final-scores-breakdown');
    this.soundStatusElem = this.panelAsset.getElementById('lbl-sound-status');
    this.aimStatusElem = this.panelAsset.getElementById('lbl-aim-status');
    this.camStatusElem = this.panelAsset.getElementById('lbl-cam-status');

    this.p1ScoreElem = this.panelAsset.getElementById('p1-score');
    this.p2ScoreElem = this.panelAsset.getElementById('p2-score');
    this.p3ScoreElem = this.panelAsset.getElementById('p3-score');
    this.p4ScoreElem = this.panelAsset.getElementById('p4-score');
    this.p1CardElem = this.panelAsset.getElementById('p1-card');
    this.p2CardElem = this.panelAsset.getElementById('p2-card');
    this.p3CardElem = this.panelAsset.getElementById('p3-card');
    this.p4CardElem = this.panelAsset.getElementById('p4-card');

    this.shotsElem = this.panelAsset.getElementById('shot-count');
    this.statusElem = this.panelAsset.getElementById('game-status');
    this.whiteElem = this.panelAsset.getElementById('white-count');
    this.blackElem = this.panelAsset.getElementById('black-count');
    this.queenElem = this.panelAsset.getElementById('queen-status');
    this.powerElem = this.panelAsset.getElementById('shot-power');

    // Interactive Buttons
    const btnPlayAlone = this.panelAsset.getElementById('btn-play-alone');
    const btnPlayFriends = this.panelAsset.getElementById('btn-play-friends');
    const btnSettings = this.panelAsset.getElementById('btn-settings');

    const btnAlonePractice = this.panelAsset.getElementById('btn-alone-practice');
    const btnAloneAI = this.panelAsset.getElementById('btn-alone-ai');
    const btnAloneBack = this.panelAsset.getElementById('btn-alone-back');

    const btnP2 = this.panelAsset.getElementById('btn-players-2');
    const btnP3 = this.panelAsset.getElementById('btn-players-3');
    const btnP4 = this.panelAsset.getElementById('btn-players-4');
    const btnFriendsBack = this.panelAsset.getElementById('btn-friends-back');

    const btnToggleSound = this.panelAsset.getElementById('btn-toggle-sound');
    const btnToggleAim = this.panelAsset.getElementById('btn-toggle-aim');
    const btnToggleCam = this.panelAsset.getElementById('btn-toggle-cam');
    const btnSettingsBack = this.panelAsset.getElementById('btn-settings-back');

    const btnTurnContinue = this.panelAsset.getElementById('btn-turn-continue');
    const btnPlayAgain = this.panelAsset.getElementById('btn-play-again');
    const btnStartMatch = this.panelAsset.getElementById('btn-start-match');

    this.btnMenuBack = this.panelAsset.getElementById('btn-menu-back');
    this.btnResetRack = this.panelAsset.getElementById('reset-button');
    this.btnXr = this.panelAsset.getElementById('xr-button');
    this.btnExitXr = this.panelAsset.getElementById('exit-button');

    // Main Menu Navigation
    if (btnPlayAlone) {
      btnPlayAlone.addEventListener('click', () => {
        carromAudio.ensureContext();
        this.showView('ALONE_MENU');
      });
    }

    if (btnAlonePractice) {
      btnAlonePractice.addEventListener('click', () => {
        carromAudio.ensureContext();
        this.startSoloMode();
      });
    }

    if (btnAloneAI) {
      btnAloneAI.addEventListener('click', () => {
        carromAudio.ensureContext();
        this.startVsAIMode();
      });
    }

    if (btnAloneBack) {
      btnAloneBack.addEventListener('click', () => {
        carromAudio.ensureContext();
        this.showView('MAIN_MENU');
      });
    }

    if (btnPlayFriends) {
      btnPlayFriends.addEventListener('click', () => {
        carromAudio.ensureContext();
        this.showView('FRIENDS_MENU');
      });
    }

    if (btnFriendsBack) {
      btnFriendsBack.addEventListener('click', () => {
        carromAudio.ensureContext();
        this.showView('MAIN_MENU');
      });
    }

    if (btnSettings) {
      btnSettings.addEventListener('click', () => {
        carromAudio.ensureContext();
        this.showView('SETTINGS');
      });
    }

    if (btnSettingsBack) {
      btnSettingsBack.addEventListener('click', () => {
        carromAudio.ensureContext();
        this.showView('MAIN_MENU');
      });
    }

    // Match Announcement Start Button
    if (btnStartMatch) {
      btnStartMatch.addEventListener('click', () => {
        carromAudio.ensureContext();
        this.showView('GAMEPLAY');
        this.gameState = 'READY';
        this.updateUI();
      });
    }

    // Friends Mode (Pass & Play)
    if (btnP2) {
      btnP2.addEventListener('click', () => {
        carromAudio.ensureContext();
        this.startPassAndPlay(2);
      });
    }
    if (btnP3) {
      btnP3.addEventListener('click', () => {
        carromAudio.ensureContext();
        this.startPassAndPlay(3);
      });
    }
    if (btnP4) {
      btnP4.addEventListener('click', () => {
        carromAudio.ensureContext();
        this.startPassAndPlay(4);
      });
    }

    // Settings Toggles
    if (btnToggleSound) {
      btnToggleSound.addEventListener('click', () => {
        const muted = carromAudio.toggleMute();
        if (this.soundStatusElem) {
          this.soundStatusElem.setProperties({
            children: muted ? 'SOUND FX: MUTED' : 'SOUND FX: ENABLED',
          });
        }
      });
    }

    if (btnToggleAim) {
      btnToggleAim.addEventListener('click', () => {
        this.aimTrajectoryFull = !this.aimTrajectoryFull;
        if (this.aimStatusElem) {
          this.aimStatusElem.setProperties({
            children: this.aimTrajectoryFull
              ? 'AIM TRAJECTORY GUIDE: FULL'
              : 'AIM TRAJECTORY GUIDE: COMPACT',
          });
        }
      });
    }

    if (btnToggleCam) {
      btnToggleCam.addEventListener('click', () => {
        if (this.camDesiredElevation > 1.1) {
          this.camDesiredElevation = 0.58;
          this.camDesiredDistance = 1.15;
          this.camDesiredAzimuth = 0;
          if (this.camStatusElem) {
            this.camStatusElem.setProperties({ children: 'CAMERA: BROADCAST 3D (ANGLED)' });
          }
        } else {
          this.camDesiredElevation = 1.45;
          this.camDesiredDistance = 0.85;
          this.camDesiredAzimuth = 0;
          if (this.camStatusElem) {
            this.camStatusElem.setProperties({ children: 'CAMERA: TOP-DOWN STRATEGIC' });
          }
        }
      });
    }

    // Turn Handover Continue
    if (btnTurnContinue) {
      btnTurnContinue.addEventListener('click', () => {
        carromAudio.ensureContext();
        this.showView('GAMEPLAY');
        this.gameState = 'READY';
        this.updateUI();
      });
    }

    // Play Again Button
    if (btnPlayAgain) {
      btnPlayAgain.addEventListener('click', () => {
        carromAudio.ensureContext();
        if (this.gameMode === 'PASS_AND_PLAY') {
          this.startPassAndPlay(this.numPlayers as 2 | 3 | 4);
        } else if (this.gameMode === 'VS_AI') {
          this.startVsAIMode();
        } else {
          this.startSoloMode();
        }
      });
    }

    // Footer Return to Menu
    if (this.btnMenuBack) {
      this.btnMenuBack.addEventListener('click', () => {
        carromAudio.ensureContext();
        this.showView('MAIN_MENU');
      });
    }

    // Footer Reset Rack
    if (this.btnResetRack) {
      this.btnResetRack.addEventListener('click', () => {
        carromAudio.ensureContext();
        this.resetRack();
      });
    }

    // WebXR Buttons
    if (this.btnXr && this.btnExitXr) {
      if (!this.world.xrEnabled) {
        this.btnXr.setProperties({ display: 'none' });
        this.btnExitXr.setProperties({ display: 'none' });
      } else {
        const launchXR = () => {
          carromAudio.ensureContext();
          this.world.launchXR();
        };
        const exitXR = () => this.world.exitXR();
        this.btnXr.addEventListener('click', launchXR);
        this.btnExitXr.addEventListener('click', exitXR);

        this.cleanupFuncs.push(
          () => this.btnXr?.removeEventListener('click', launchXR),
          () => this.btnExitXr?.removeEventListener('click', exitXR),
          this.world.visibilityState.subscribe((state) => {
            const is2D = state === VisibilityState.NonImmersive;
            if (this.btnXr) {
              this.btnXr.setProperties({
                display: is2D && this.currentView !== 'TURN_PASS' ? 'flex' : 'none',
              });
            }
            if (this.btnExitXr) {
              this.btnExitXr.setProperties({ display: is2D ? 'none' : 'flex' });
            }
            this.updateUI();
          }),
        );
      }
    }

    // Initial View
    this.showView('MAIN_MENU');
  }

  public showView(view: ViewScreen): void {
    this.currentView = view;

    const setDisplay = (elem: any, visible: boolean) => {
      if (elem) elem.setProperties({ display: visible ? 'flex' : 'none' });
    };

    setDisplay(this.viewMainMenu, view === 'MAIN_MENU');
    setDisplay(this.viewAloneMenu, view === 'ALONE_MENU');
    setDisplay(this.viewFriendsMenu, view === 'FRIENDS_MENU');
    setDisplay(this.viewSettingsMenu, view === 'SETTINGS');
    setDisplay(this.viewMatchAnnouncement, view === 'MATCH_ANNOUNCEMENT');
    setDisplay(this.viewGameplay, view === 'GAMEPLAY');
    setDisplay(this.viewTurnPass, view === 'TURN_PASS');
    setDisplay(this.viewGameOver, view === 'GAME_OVER');
    setDisplay(
      this.brandHeaderElem,
      view === 'MAIN_MENU' ||
        view === 'ALONE_MENU' ||
        view === 'FRIENDS_MENU' ||
        view === 'SETTINGS',
    );

    // Bottom Action Buttons
    setDisplay(
      this.btnMenuBack,
      view !== 'MAIN_MENU' &&
        view !== 'ALONE_MENU' &&
        view !== 'FRIENDS_MENU' &&
        view !== 'SETTINGS',
    );
    setDisplay(this.btnResetRack, view === 'GAMEPLAY');

    if (this.btnXr) {
      const is2D = this.world.visibilityState.value === VisibilityState.NonImmersive;
      setDisplay(
        this.btnXr,
        is2D && (view === 'MAIN_MENU' || view === 'GAMEPLAY' || view === 'MATCH_ANNOUNCEMENT'),
      );
    }

    // Update halo & reticle colors for active player
    if (this.strikerHaloMesh) {
      (this.strikerHaloMesh.material as MeshBasicMaterial).color.setHex(
        this.getCurrentPlayer().colorHex,
      );
    }

    this.updateUI();
  }

  public startSoloMode(): void {
    this.gameMode = 'SOLO';
    this.numPlayers = 1;
    this.currentPlayerIndex = 0;
    this.queenCoverState = 'NONE';
    this.queenCoverPlayerIndex = -1;
    this.players[0].name = 'SOLO PLAYER';
    this.players[0].score = 0;

    if (this.p3CardElem) this.p3CardElem.setProperties({ display: 'none' });
    if (this.p4CardElem) this.p4CardElem.setProperties({ display: 'none' });

    this.resetRack();
    this.showView('GAMEPLAY');
  }

  public startVsAIMode(): void {
    this.gameMode = 'VS_AI';
    this.numPlayers = 2;
    this.currentPlayerIndex = 0;
    this.queenCoverState = 'NONE';
    this.queenCoverPlayerIndex = -1;
    this.aiThinkingTimer = 0;

    this.players[0].name = 'Player 1';
    this.players[0].score = 0;
    this.players[1].name = 'AI Bot';
    this.players[1].score = 0;

    if (this.p3CardElem) this.p3CardElem.setProperties({ display: 'none' });
    if (this.p4CardElem) this.p4CardElem.setProperties({ display: 'none' });

    this.resetRack();

    if (this.matchAnnouncementTitleElem) {
      this.matchAnnouncementTitleElem.setProperties({
        children: 'PLAYER 1 BREAKS FIRST!',
      });
    }
    if (this.matchAnnouncementSubElem) {
      this.matchAnnouncementSubElem.setProperties({
        children: 'Player 1 (Gold) vs AI Bot (Cyan) — Take opening break!',
      });
    }

    this.showView('MATCH_ANNOUNCEMENT');
  }

  public startPassAndPlay(playerCount: 2 | 3 | 4): void {
    this.gameMode = 'PASS_AND_PLAY';
    this.numPlayers = playerCount;
    this.currentPlayerIndex = 0;
    this.queenCoverState = 'NONE';
    this.queenCoverPlayerIndex = -1;

    for (let i = 0; i < 4; i++) {
      this.players[i].name = `Player ${i + 1}`;
      this.players[i].score = 0;
    }

    if (this.p3CardElem) {
      this.p3CardElem.setProperties({ display: playerCount >= 3 ? 'flex' : 'none' });
    }
    if (this.p4CardElem) {
      this.p4CardElem.setProperties({ display: playerCount >= 4 ? 'flex' : 'none' });
    }

    this.resetRack();

    if (this.matchAnnouncementTitleElem) {
      this.matchAnnouncementTitleElem.setProperties({
        children: 'PLAYER 1 BREAKS FIRST!',
      });
    }
    if (this.matchAnnouncementSubElem) {
      this.matchAnnouncementSubElem.setProperties({
        children: `Toss won by Player 1 (Gold) — Break the rack in ${playerCount}-Player Pass & Play!`,
      });
    }

    this.showView('MATCH_ANNOUNCEMENT');
  }

  private updateUI(): void {
    // 1. Player Scores & Card Highlight
    if (this.p1ScoreElem) {
      this.p1ScoreElem.setProperties({ children: this.players[0].score.toString() });
    }
    if (this.p2ScoreElem) {
      this.p2ScoreElem.setProperties({ children: this.players[1].score.toString() });
    }
    if (this.p3ScoreElem) {
      this.p3ScoreElem.setProperties({ children: this.players[2].score.toString() });
    }
    if (this.p4ScoreElem) {
      this.p4ScoreElem.setProperties({ children: this.players[3].score.toString() });
    }

    // Highlight active player card
    const activeIdx = this.currentPlayerIndex;
    const cards = [this.p1CardElem, this.p2CardElem, this.p3CardElem, this.p4CardElem];
    cards.forEach((card, idx) => {
      if (!card) return;
      if (idx === activeIdx) {
        card.setProperties({
          backgroundColor: 'rgba(255, 255, 255, 0.14)',
          borderRadius: 8,
          paddingLeft: 8,
          paddingRight: 8,
        });
      } else {
        card.setProperties({
          backgroundColor: 'transparent',
          borderRadius: 0,
          paddingLeft: 4,
          paddingRight: 4,
        });
      }
    });

    // 2. Turn Banner
    const currPlayer = this.getCurrentPlayer();
    if (this.turnTitleElem) {
      let bannerText = '';
      if (this.gameMode === 'SOLO') {
        bannerText = 'SOLO PRACTICE ROUND';
      } else if (this.gameMode === 'VS_AI') {
        bannerText =
          currPlayer.id === 1
            ? "PLAYER 1'S TURN (GOLD)"
            : 'AI BOT IS AIMING (CYAN)';
      } else {
        bannerText = `${currPlayer.name.toUpperCase()}'S TURN (${currPlayer.colorName})`;
      }
      this.turnTitleElem.setProperties({ children: bannerText });
    }

    if (this.turnExtraElem) {
      this.turnExtraElem.setProperties({
        display: this.hasExtraStrike ? 'flex' : 'none',
      });
    }

    if (this.turnQueenCoverElem) {
      this.turnQueenCoverElem.setProperties({
        display: this.queenCoverState === 'NEEDS_COVER' ? 'flex' : 'none',
      });
    }

    // 3. Stats & Pieces
    if (this.shotsElem) {
      this.shotsElem.setProperties({ children: this.shots.toString() });
    }
    if (this.whiteElem) {
      this.whiteElem.setProperties({ children: `${this.whiteRemaining} / 9` });
    }
    if (this.blackElem) {
      this.blackElem.setProperties({ children: `${this.blackRemaining} / 9` });
    }
    if (this.queenElem) {
      let qText = 'CENTER';
      if (this.queenPocketed) {
        qText = 'COVERED';
      } else if (this.queenCoverState === 'NEEDS_COVER') {
        qText = 'PENDING COVER';
      }
      this.queenElem.setProperties({ children: qText });
    }

    // 4. Shot Power display
    if (this.powerElem) {
      const pct = Math.round(this.currentPowerRatio * 100);
      const barsCount = Math.round(this.currentPowerRatio * 8);
      const bars = '|'.repeat(barsCount) + '.'.repeat(8 - barsCount);
      this.powerElem.setProperties({
        children: `${pct}% [${bars}]`,
      });
    }

    // 5. Status display
    if (this.statusElem) {
      let statusText = 'READY TO STRIKE';
      if (this.gameState === 'COMPLETED') {
        statusText = `BOARD CLEARED IN ${this.shots} SHOTS!`;
      } else if (this.lastFoulNotice) {
        statusText = 'FOUL! STRIKER POCKETED (-5 PTS)';
      } else if (this.gameMode === 'VS_AI' && this.currentPlayerIndex === 1) {
        statusText = 'AI BOT IS CALCULATING SHOT...';
      } else if (this.queenCoverState === 'NEEDS_COVER') {
        statusText = `${currPlayer.name} POCKETED QUEEN! COVER IT NOW!`;
      } else if (this.hasExtraStrike) {
        statusText = `${currPlayer.name} SCORED! EXTRA STRIKE!`;
      } else if (this.isImmersiveXR()) {
        if (this.gameState === 'SIMULATING') {
          statusText = 'VR: PIECES ROLLING...';
        } else if (this.gameState === 'AIMING') {
          statusText = `VR: AIMING (${Math.round(this.currentPowerRatio * 100)}%)`;
        } else {
          statusText = 'VR: PINCH STRIKER TO AIM';
        }
      } else {
        if (this.gameState === 'SIMULATING') {
          statusText = 'ROLLING...';
        } else if (this.gameState === 'AIMING') {
          statusText = `POWER: ${Math.round(this.currentPowerRatio * 100)}%`;
        } else {
          statusText = 'PULL STRIKER BACK & RELEASE';
        }
      }
      this.statusElem.setProperties({ children: statusText });
    }
  }

  public resetRack(): void {
    this.shots = 0;
    this.whiteRemaining = 9;
    this.blackRemaining = 9;
    this.queenPocketed = false;
    this.lastFoulNotice = false;
    this.coinsPottedInTurn = 0;
    this.foulInTurn = false;
    this.hasExtraStrike = false;
    this.queenCoverState = 'NONE';
    this.queenCoverPlayerIndex = -1;
    this.queenPottedThisStrike = false;
    this.aiThinkingTimer = 0;
    this.gameState = 'READY';
    this.isVRHandGrabbed = false;
    this.setAimGuideVisible(false);

    for (const entity of this.queries.pieces.entities) {
      const obj = entity.object3D;
      if (!obj) continue;

      const initX = entity.getValue(CarromPiece, 'initialX') || 0;
      const initY = entity.getValue(CarromPiece, 'initialY') || 0.754;
      const initZ = entity.getValue(CarromPiece, 'initialZ') || 0;

      const item = this.entityBodyMap.get(obj.name);
      if (item) {
        item.body.x = initX;
        item.body.z = initZ;
        item.body.vx = 0;
        item.body.vz = 0;
        item.body.active = true;
        item.body.pocketed = false;
      }

      obj.position.set(initX, initY, initZ);
      obj.scale.set(1, 1, 1);
      obj.visible = true;
    }

    if (this.strikerBody && this.strikerMesh) {
      this.setStrikerBaselineX(0);
    }

    this.updateUI();
  }

  update(delta: number): void {
    // 1. Process VR Hand Tracking & XR inputs
    this.processVRHandTracking();

    // 2. Smooth Angled 3D Camera Orbit & Zoom (Desktop / Mobile 2D)
    this.updateDesktopCamera(delta);

    // 3. Process AI thinking timer
    if (this.aiThinkingTimer > 0) {
      this.aiThinkingTimer -= delta;
      if (this.aiThinkingTimer <= 0) {
        this.executeAIShot();
      }
    }

    // 4. Physics simulation step & animations
    if (this.gameState === 'SIMULATING') {
      const clampedDelta = Math.min(0.033, Math.max(0.001, delta));
      this.physicsWorld.step(clampedDelta, 10);

      // Smooth visual syncing and pocketing animations
      for (const { body, mesh } of this.entityBodyMap.values()) {
        if (!mesh) continue;

        if (body.pocketed) {
          // Drop smoothly into the pocket net cup and shrink
          if (mesh.position.y > 0.718) {
            mesh.position.y -= delta * 0.18;
            mesh.scale.multiplyScalar(Math.max(0, 1 - delta * 5));
          } else {
            mesh.visible = false;
          }
        } else {
          mesh.position.x = body.x;
          mesh.position.z = body.z;
        }
      }

      // Check if all pieces have come to rest
      if (this.physicsWorld.isResting()) {
        // Return striker smoothly to baseline
        if (this.strikerBody && this.strikerMesh) {
          this.strikerBody.x = 0;
          this.strikerBody.z = this.baselineZ;
          this.strikerBody.vx = 0;
          this.strikerBody.vz = 0;
          this.strikerBody.pocketed = false;
          this.strikerBody.active = true;

          this.strikerMesh.position.set(0, 0.75425, this.baselineZ);
          this.strikerMesh.scale.set(1, 1, 1);
          this.strikerMesh.visible = true;
          this.strikerHaloMesh.position.set(0, this.boardSurfaceY + 0.001, this.baselineZ);
          this.powerArcMesh.position.set(0, this.boardSurfaceY + 0.0012, this.baselineZ);
        }

        // Return penalty coin on foul
        if (this.foulInTurn) {
          this.returnPenaltyCoin();
        }

        // Tournament Queen Covering resolution
        let extraStrikeFromCover = false;
        if (this.queenCoverState === 'NEEDS_COVER') {
          if (this.queenPottedThisStrike) {
            // Player just pocketed Queen solo: gets an extra strike right now to cover!
            this.hasExtraStrike = true;
            this.gameState = 'READY';
            this.updateUI();
            if (this.gameMode === 'VS_AI' && this.currentPlayerIndex === 1) {
              this.scheduleAITurn();
            }
            return;
          } else {
            // This was the cover attempt strike
            if (this.foulInTurn) {
              // Cover failed due to foul!
              this.returnQueenToCenter();
              this.queenCoverState = 'NONE';
              this.queenCoverPlayerIndex = -1;
            } else if (this.coinsPottedInTurn > 0) {
              // Succeeded! Pocketed coin covered Queen (+25 pts)
              if (this.queenCoverPlayerIndex >= 0 && this.players[this.queenCoverPlayerIndex]) {
                this.players[this.queenCoverPlayerIndex].score += 25;
              }
              this.queenPocketed = true;
              this.queenCoverState = 'NONE';
              this.queenCoverPlayerIndex = -1;
              extraStrikeFromCover = true;
            } else {
              // Failed cover (no coin pocketed): Queen returns to center
              this.returnQueenToCenter();
              this.queenCoverState = 'NONE';
              this.queenCoverPlayerIndex = -1;
            }
          }
        }

        // Game Completion Check
        if ((this.gameState as string) === 'COMPLETED') {
          this.showGameOverScreen();
          return;
        }

        // Turn Management
        if (this.gameMode === 'SOLO') {
          this.hasExtraStrike =
            (this.coinsPottedInTurn > 0 && !this.foulInTurn) || extraStrikeFromCover;
          this.gameState = 'READY';
          this.updateUI();
        } else if (this.gameMode === 'VS_AI') {
          if (this.currentPlayerIndex === 0) {
            // Human player
            if ((this.coinsPottedInTurn > 0 && !this.foulInTurn) || extraStrikeFromCover) {
              this.hasExtraStrike = true;
              this.gameState = 'READY';
              this.updateUI();
            } else {
              // Switch to AI
              this.hasExtraStrike = false;
              this.currentPlayerIndex = 1;
              this.gameState = 'READY';
              this.updateUI();
              this.scheduleAITurn();
            }
          } else {
            // AI player
            if ((this.coinsPottedInTurn > 0 && !this.foulInTurn) || extraStrikeFromCover) {
              this.hasExtraStrike = true;
              this.gameState = 'READY';
              this.updateUI();
              this.scheduleAITurn();
            } else {
              // Switch back to Human
              this.hasExtraStrike = false;
              this.currentPlayerIndex = 0;
              this.gameState = 'READY';
              this.updateUI();
            }
          }
        } else {
          // Pass-and-Play Multiplayer logic:
          if ((this.coinsPottedInTurn > 0 && !this.foulInTurn) || extraStrikeFromCover) {
            this.hasExtraStrike = true;
            this.gameState = 'READY';
            this.updateUI();
          } else {
            // Turn switches to next player!
            this.hasExtraStrike = false;
            this.gameState = 'READY';
            this.currentPlayerIndex =
              (this.currentPlayerIndex + 1) % this.numPlayers;
            const nextPlayer = this.getCurrentPlayer();

            if (this.passInstructionElem) {
              this.passInstructionElem.setProperties({
                children: `Pass the device to ${nextPlayer.name.toUpperCase()} (${nextPlayer.colorName})`,
              });
            }

            this.showView('TURN_PASS');
          }
        }
      }
    }
  }

  private scheduleAITurn(): void {
    if (this.gameMode !== 'VS_AI' || this.currentPlayerIndex !== 1) return;
    this.aiThinkingTimer = 0.8;
  }

  private executeAIShot(): void {
    if (
      this.gameMode !== 'VS_AI' ||
      this.currentPlayerIndex !== 1 ||
      this.gameState !== 'READY' ||
      !this.strikerBody
    ) {
      return;
    }

    const activeCoins = Array.from(this.entityBodyMap.values()).filter(
      ({ body }) => body.active && !body.pocketed && body.type !== 'striker',
    );

    if (activeCoins.length === 0) return;

    const pockets = [
      { x: -0.332, z: -0.332 },
      { x: 0.332, z: -0.332 },
      { x: -0.332, z: -0.968 },
      { x: 0.332, z: -0.968 },
    ];

    let bestScore = -Infinity;
    let bestCoin = activeCoins[0].body;
    let bestPocket = pockets[0];

    for (const { body: coin } of activeCoins) {
      for (const pocket of pockets) {
        const dist = Math.hypot(pocket.x - coin.x, pocket.z - coin.z);
        let score = 1.0 / (dist + 0.05);
        if (coin.type === 'black') score *= 1.25;
        if (coin.type === 'queen') score *= 1.5;
        if (score > bestScore) {
          bestScore = score;
          bestCoin = coin;
          bestPocket = pocket;
        }
      }
    }

    // Direction from coin to target pocket
    const cpDx = bestPocket.x - bestCoin.x;
    const cpDz = bestPocket.z - bestCoin.z;
    const cpDist = Math.hypot(cpDx, cpDz) || 1;
    const dirPocketX = cpDx / cpDist;
    const dirPocketZ = cpDz / cpDist;

    // Desired impact point behind the coin
    const impactDist = bestCoin.radius + this.strikerBody.radius;
    const impactX = bestCoin.x - dirPocketX * impactDist;
    const impactZ = bestCoin.z - dirPocketZ * impactDist;

    // Striker baseline position
    const idealStrikerX = Math.max(-0.21, Math.min(0.21, impactX));
    this.setStrikerBaselineX(idealStrikerX);

    // Direction from striker to impact point
    const sDx = impactX - idealStrikerX;
    const sDz = impactZ - this.baselineZ;
    const sDist = Math.hypot(sDx, sDz) || 1;
    const shotDirX = sDx / sDist;
    const shotDirZ = sDz / sDist;

    const totalDist = sDist + cpDist;
    const powerRatio = Math.max(0.42, Math.min(0.85, totalDist * 0.9));
    const speed = powerRatio * this.maxShotSpeed;

    this.fireShot(shotDirX * speed, shotDirZ * speed, powerRatio);
  }

  private showGameOverScreen(): void {
    if (this.gameMode === 'SOLO') {
      if (this.winnerBannerElem) {
        this.winnerBannerElem.setProperties({
          children: 'SOLO PRACTICE CLEARED!',
        });
      }
      if (this.finalScoresElem) {
        this.finalScoresElem.setProperties({
          children: `Final Score: ${this.players[0].score} pts in ${this.shots} strikes`,
        });
      }
    } else if (this.gameMode === 'VS_AI') {
      const p1 = this.players[0];
      const ai = this.players[1];
      let winText = "IT'S A DRAW WITH AI BOT!";
      if (p1.score > ai.score) winText = 'PLAYER 1 DEFEATS AI BOT!';
      else if (ai.score > p1.score) winText = 'AI BOT WINS MATCH!';

      if (this.winnerBannerElem) {
        this.winnerBannerElem.setProperties({ children: winText });
      }
      if (this.finalScoresElem) {
        this.finalScoresElem.setProperties({
          children: `${p1.name}: ${p1.score} pts  |  ${ai.name}: ${ai.score} pts`,
        });
      }
    } else {
      // Find winner with highest score
      const activePlayers = this.players.slice(0, this.numPlayers);
      const sorted = [...activePlayers].sort((a, b) => b.score - a.score);
      const winner = sorted[0];
      const isTie = sorted.length > 1 && sorted[0].score === sorted[1].score;

      if (this.winnerBannerElem) {
        this.winnerBannerElem.setProperties({
          children: isTie
            ? `IT'S A TIE AT ${winner.score} PTS!`
            : `${winner.name.toUpperCase()} WINS TOURNAMENT!`,
        });
      }

      if (this.finalScoresElem) {
        const summary = sorted
          .map((p) => `${p.name} (${p.colorName}): ${p.score} pts`)
          .join('  |  ');
        this.finalScoresElem.setProperties({
          children: summary,
        });
      }
    }

    this.showView('GAME_OVER');
  }

  /**
   * Smooth Angled 3D Broadcast Camera with Orbit Rotation and Zoom Damping.
   */
  private updateDesktopCamera(delta: number): void {
    if (this.isImmersiveXR()) return;

    const factor = Math.min(1.0, delta * 12);
    this.camCurrentDistance +=
      (this.camDesiredDistance - this.camCurrentDistance) * factor;
    this.camCurrentAzimuth +=
      (this.camDesiredAzimuth - this.camCurrentAzimuth) * factor;
    this.camCurrentElevation +=
      (this.camDesiredElevation - this.camCurrentElevation) * factor;

    const cosElev = Math.cos(this.camCurrentElevation);
    const sinElev = Math.sin(this.camCurrentElevation);
    const cosAzim = Math.cos(this.camCurrentAzimuth);
    const sinAzim = Math.sin(this.camCurrentAzimuth);

    const cx =
      this.camTarget.x +
      this.camCurrentDistance * cosElev * sinAzim;
    const cy =
      this.camTarget.y +
      this.camCurrentDistance * sinElev;
    const cz =
      this.camTarget.z +
      this.camCurrentDistance * cosElev * cosAzim;

    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(this.camTarget);
  }
}
