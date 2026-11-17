/**
 * Standalone test for Carrom 2D Physics Engine.
 */

export interface CarromBody {
  id: string;
  type: 'striker' | 'queen' | 'white' | 'black';
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  mass: number;
  active: boolean;
  pocketed: boolean;
}

export interface PocketEvent {
  body: CarromBody;
  pocketIndex: number;
}

export class CarromPhysicsWorld {
  public bodies: CarromBody[] = [];
  public readonly boardCenterX = 0;
  public readonly boardCenterZ = -0.65;
  public readonly halfSize = 0.37; // 0.74m inner size / 2

  // Boundaries
  public readonly minX: number;
  public readonly maxX: number;
  public readonly minZ: number;
  public readonly maxZ: number;

  // 4 Pockets
  public readonly pockets: { x: number; z: number; radius: number }[];

  public onPocketed?: (event: PocketEvent) => void;
  public onCollision?: (b1: CarromBody, b2: CarromBody, impulse: number) => void;

  constructor() {
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

  public addBody(body: CarromBody): void {
    this.bodies.push(body);
  }

  public clear(): void {
    this.bodies = [];
  }

  public isResting(): boolean {
    for (const b of this.bodies) {
      if (!b.active || b.pocketed) continue;
      if (Math.abs(b.vx) > 0.002 || Math.abs(b.vz) > 0.002) {
        return false;
      }
    }
    return true;
  }

  public step(dt: number, subSteps = 8): void {
    const subDt = dt / subSteps;
    for (let s = 0; s < subSteps; s++) {
      this.subStep(subDt);
    }
  }

  private subStep(dt: number): void {
    // 1. Position update & friction
    const frictionDecel = 0.40; // m/s^2
    const damping = Math.pow(0.85, dt);

    for (const b of this.bodies) {
      if (!b.active || b.pocketed) continue;

      // Integrate position
      b.x += b.vx * dt;
      b.z += b.vz * dt;

      // Apply friction
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

      // Check pockets
      for (let pIdx = 0; pIdx < this.pockets.length; pIdx++) {
        const p = this.pockets[pIdx];
        const dist = Math.hypot(b.x - p.x, b.z - p.z);
        if (dist < p.radius) {
          b.pocketed = true;
          b.active = false;
          b.vx = 0;
          b.vz = 0;
          if (this.onPocketed) {
            this.onPocketed({ body: b, pocketIndex: pIdx });
          }
          break;
        }
      }

      if (b.pocketed) continue;

      // Wall collisions with restitution
      const eWall = 0.82;
      const r = b.radius;

      if (b.x - r < this.minX) {
        b.x = this.minX + r;
        if (b.vx < 0) b.vx = -b.vx * eWall;
      } else if (b.x + r > this.maxX) {
        b.x = this.maxX - r;
        if (b.vx > 0) b.vx = -b.vx * eWall;
      }

      if (b.z - r < this.minZ) {
        b.z = this.minZ + r;
        if (b.vz < 0) b.vz = -b.vz * eWall;
      } else if (b.z + r > this.maxZ) {
        b.z = this.maxZ - r;
        if (b.vz > 0) b.vz = -b.vz * eWall;
      }
    }

    // 2. Body-Body collisions
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

          // Separation by mass ratio
          const mTotal = b1.mass + b2.mass;
          const w1 = b2.mass / mTotal;
          const w2 = b1.mass / mTotal;

          b1.x -= nx * overlap * w1;
          b1.z -= nz * overlap * w1;
          b2.x += nx * overlap * w2;
          b2.z += nz * overlap * w2;

          // Relative velocity along normal
          const dvx = b2.vx - b1.vx;
          const dvz = b2.vz - b1.vz;
          const vRelNormal = dvx * nx + dvz * nz;

          if (vRelNormal < 0) {
            const impulse = (-(1 + eCoin) * vRelNormal) / (1 / b1.mass + 1 / b2.mass);
            b1.vx -= (impulse / b1.mass) * nx;
            b1.vz -= (impulse / b1.mass) * nz;
            b2.vx += (impulse / b2.mass) * nx;
            b2.vz += (impulse / b2.mass) * nz;

            if (this.onCollision && impulse > 0.005) {
              this.onCollision(b1, b2, impulse);
            }
          }
        }
      }
    }
  }
}
