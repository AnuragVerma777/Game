/**
 * Automated test script for Carrom Physics simulation
 */

class CarromPhysicsWorld {
  constructor() {
    this.bodies = [];
    this.boardCenterX = 0;
    this.boardCenterZ = -0.65;
    this.halfSize = 0.37;

    this.minX = this.boardCenterX - this.halfSize;
    this.maxX = this.boardCenterX + this.halfSize;
    this.minZ = this.boardCenterZ - this.halfSize;
    this.maxZ = this.boardCenterZ + this.halfSize;

    const pocketOffset = 0.332;
    const pocketRadius = 0.024;

    this.pockets = [
      { x: this.boardCenterX - pocketOffset, z: this.boardCenterZ - pocketOffset, radius: pocketRadius },
      { x: this.boardCenterX + pocketOffset, z: this.boardCenterZ - pocketOffset, radius: pocketRadius },
      { x: this.boardCenterX - pocketOffset, z: this.boardCenterZ + pocketOffset, radius: pocketRadius },
      { x: this.boardCenterX + pocketOffset, z: this.boardCenterZ + pocketOffset, radius: pocketRadius },
    ];
  }

  addBody(body) {
    this.bodies.push(body);
  }

  isResting() {
    for (const b of this.bodies) {
      if (!b.active || b.pocketed) continue;
      if (Math.abs(b.vx) > 0.002 || Math.abs(b.vz) > 0.002) return false;
    }
    return true;
  }

  step(dt, subSteps = 8) {
    const subDt = dt / subSteps;
    for (let s = 0; s < subSteps; s++) {
      this.subStep(subDt);
    }
  }

  subStep(dt) {
    const frictionDecel = 0.40;
    const damping = Math.pow(0.85, dt);

    for (const b of this.bodies) {
      if (!b.active || b.pocketed) continue;

      b.x += b.vx * dt;
      b.z += b.vz * dt;

      const speed = Math.hypot(b.vx, b.vz);
      if (speed > 0) {
        const newSpeed = Math.max(0, speed - frictionDecel * dt) * damping;
        if (newSpeed <= 0.002) {
          b.vx = 0;
          b.vz = 0;
        } else {
          const ratio = newSpeed / speed;
          b.vx *= ratio;
          b.vz *= ratio;
        }
      }

      for (let pIdx = 0; pIdx < this.pockets.length; pIdx++) {
        const p = this.pockets[pIdx];
        const dist = Math.hypot(b.x - p.x, b.z - p.z);
        if (dist < p.radius) {
          b.pocketed = true;
          b.active = false;
          b.vx = 0;
          b.vz = 0;
          if (this.onPocketed) this.onPocketed({ body: b, pocketIndex: pIdx });
          break;
        }
      }

      if (b.pocketed) continue;

      const eWall = 0.82;
      const r = b.radius;

      if (b.x - r < this.minX) {
        b.x = this.minX + r;
        if (b.vx < 0) {
          b.vx = -b.vx * eWall;
          if (this.onWallHit) this.onWallHit(b);
        }
      } else if (b.x + r > this.maxX) {
        b.x = this.maxX - r;
        if (b.vx > 0) {
          b.vx = -b.vx * eWall;
          if (this.onWallHit) this.onWallHit(b);
        }
      }

      if (b.z - r < this.minZ) {
        b.z = this.minZ + r;
        if (b.vz < 0) {
          b.vz = -b.vz * eWall;
          if (this.onWallHit) this.onWallHit(b);
        }
      } else if (b.z + r > this.maxZ) {
        b.z = this.maxZ - r;
        if (b.vz > 0) {
          b.vz = -b.vz * eWall;
          if (this.onWallHit) this.onWallHit(b);
        }
      }
    }

    const eCoin = 0.88;
    const count = this.bodies.length;

    for (let i = 0; i < count; i++) {
      const b1 = this.bodies[i];
      if (!b1.active || b1.pocketed) continue;

      for (let j = i + 1; j < count; j++) {
        const b2 = this.bodies[j];
        if (!b2.active || b2.pocketed) continue;

        const dx = b2.x - b1.x;
        const dz = b2.z - b1.z;
        const dist = Math.hypot(dx, dz);
        const minDist = b1.radius + b2.radius;

        if (dist < minDist && dist > 1e-6) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const nz = dz / dist;

          const mTotal = b1.mass + b2.mass;
          const w1 = b2.mass / mTotal;
          const w2 = b1.mass / mTotal;

          b1.x -= nx * overlap * w1;
          b1.z -= nz * overlap * w1;
          b2.x += nx * overlap * w2;
          b2.z += nz * overlap * w2;

          const dvx = b2.vx - b1.vx;
          const dvz = b2.vz - b1.vz;
          const vRelNormal = dvx * nx + dvz * nz;

          if (vRelNormal < 0) {
            const impulse = (-(1 + eCoin) * vRelNormal) / (1 / b1.mass + 1 / b2.mass);
            b1.vx -= (impulse / b1.mass) * nx;
            b1.vz -= (impulse / b1.mass) * nz;
            b2.vx += (impulse / b2.mass) * nx;
            b2.vz += (impulse / b2.mass) * nz;

            if (this.onCollision) {
              this.onCollision(b1, b2, impulse);
            }
          }
        }
      }
    }
  }
}

// RUN TESTS
console.log('=== Running Carrom Physics Tests ===');

// Test 1: Friction & Stopping
{
  const world = new CarromPhysicsWorld();
  const striker = { id: 'striker', type: 'striker', x: 0, z: -0.41, vx: 0, vz: -1.5, radius: 0.02065, mass: 3.0, active: true, pocketed: false };
  world.addBody(striker);

  let steps = 0;
  while (!world.isResting() && steps < 1000) {
    world.step(0.016);
    steps++;
  }
  console.log(`[Test 1: Friction & Stopping] Striker stopped in ${steps} steps (${(steps * 0.016).toFixed(2)}s). Speed: ${Math.hypot(striker.vx, striker.vz).toFixed(4)}.`);
  if (!world.isResting() || striker.vz !== 0) throw new Error('Striker failed to stop');
}

// Test 2: Coin-Coin Collision
{
  const world = new CarromPhysicsWorld();
  let collisionCount = 0;
  world.onCollision = () => collisionCount++;

  const striker = { id: 'striker', type: 'striker', x: 0, z: -0.41, vx: 0, vz: -2.0, radius: 0.02065, mass: 3.0, active: true, pocketed: false };
  const coin = { id: 'queen', type: 'queen', x: 0, z: -0.65, vx: 0, vz: 0, radius: 0.0159, mass: 1.0, active: true, pocketed: false };
  world.addBody(striker);
  world.addBody(coin);

  for (let i = 0; i < 60; i++) {
    world.step(0.016);
  }
  console.log(`[Test 2: Coin-Coin Collision] Collision detected: ${collisionCount > 0}. Coin moved from -0.65 to ${coin.z.toFixed(4)}.`);
  if (collisionCount === 0 || coin.z >= -0.65) throw new Error('Collision failed');
}

// Test 3: Wall Rebound
{
  const world = new CarromPhysicsWorld();
  let wallHit = false;
  world.onWallHit = () => wallHit = true;

  const striker = { id: 'striker', type: 'striker', x: 0, z: -0.41, vx: 2.5, vz: 0, radius: 0.02065, mass: 3.0, active: true, pocketed: false };
  world.addBody(striker);

  for (let i = 0; i < 60; i++) {
    world.step(0.016);
  }
  console.log(`[Test 3: Wall Rebound] Wall hit detected: ${wallHit}. Striker bounced. Current x: ${striker.x.toFixed(3)} (within [${world.minX.toFixed(2)}, ${world.maxX.toFixed(2)}]).`);
  if (!wallHit || striker.x > world.maxX) throw new Error('Wall rebound failed');
}

// Test 4: Pocket Detection
{
  const world = new CarromPhysicsWorld();
  let pocketEvent = null;
  world.onPocketed = (ev) => pocketEvent = ev;

  // Aim directly into the top-right pocket (x: 0.332, z: -0.982)
  const targetPocket = world.pockets[1];
  const coin = { id: 'white-1', type: 'white', x: targetPocket.x - 0.04, z: targetPocket.z + 0.04, vx: 0.6, vz: -0.6, radius: 0.0159, mass: 1.0, active: true, pocketed: false };
  world.addBody(coin);

  for (let i = 0; i < 60; i++) {
    world.step(0.016);
  }
  console.log(`[Test 4: Pocket Detection] Coin pocketed: ${coin.pocketed}. Event triggered: ${pocketEvent !== null}.`);
  if (!coin.pocketed) throw new Error('Pocket detection failed');
}

console.log('=== All 4 Physics Unit Tests Passed Successfully! ===');
