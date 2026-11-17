/**
 * Computer-driven cars. They are not simulated with the full tyre model: each
 * follows the circuit at a speed taken from a precomputed corner/braking
 * profile, scaled by a per-driver pace, and steers around slower cars.
 * Pure logic with no rendering, so it runs headlessly in the tests.
 */
import { SAMPLE_SPACING, TRACK_HALF_WIDTH, track } from '../track/trackData'
import { CAR } from '../vehicle/vehiclePhysics'
import type { DriverSpec } from './drivers'

const G = 9.81
const V_MAX = 92
const BRAKE = 24
const AIR = 0.00094

/** acceleration available at speed v (m/s^2): traction-limited low down, power-limited high up */
export const accelCap = (v: number) => Math.max(0.8, Math.min(12, 931 / Math.max(v, 8) - AIR * v * v))

let profile: Float32Array | null = null

/** Highest speed (m/s) at each sample: corner limit, braking before it, acceleration after it. */
function buildProfile(): Float32Array {
  const { samples, count, length } = track
  const ds = length / count
  const v = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const den = Math.abs(samples[i].k) - 1.45 * 0.0028
    v[i] = den <= 1e-5 ? V_MAX : Math.min(V_MAX, Math.sqrt((1.45 * G) / den))
  }
  for (let pass = 0; pass < 3; pass++) {
    for (let i = count - 1; i >= 0; i--) {
      const n = (i + 1) % count
      v[i] = Math.min(v[i], Math.sqrt(v[n] * v[n] + 2 * BRAKE * ds))
    }
    for (let i = 0; i < count; i++) {
      const p = (i - 1 + count) % count
      v[i] = Math.min(v[i], Math.sqrt(v[p] * v[p] + 2 * accelCap(v[p]) * ds))
    }
  }
  return v
}

export const wrapS = (s: number) => ((s % track.length) + track.length) % track.length

export function profileAt(s: number): number {
  profile ??= buildProfile()
  const f = (wrapS(s) / track.length) * track.count
  const i = Math.floor(f), t = f - i
  return profile[i % track.count] * (1 - t) + profile[(i + 1) % track.count] * t
}

export interface RoadPoint { x: number; z: number; tx: number; tz: number; y: number; k: number; dy: number }
const rp: RoadPoint = { x: 0, z: 0, tx: 1, tz: 0, y: 0, k: 0, dy: 0 }

/** Interpolated centre-line point at distance s along the lap (reused object). */
export function roadAt(s: number, out: RoadPoint = rp): RoadPoint {
  const { samples, count, length } = track
  const f = (wrapS(s) / length) * count
  const i = Math.floor(f) % count, t = f - Math.floor(f)
  const a = samples[i], b = samples[(i + 1) % count]
  out.x = a.x + (b.x - a.x) * t
  out.z = a.z + (b.z - a.z) * t
  let tx = a.tx + (b.tx - a.tx) * t, tz = a.tz + (b.tz - a.tz) * t
  const l = Math.hypot(tx, tz) || 1
  tx /= l; tz /= l
  out.tx = tx; out.tz = tz
  out.y = a.y + (b.y - a.y) * t
  out.k = a.k + (b.k - a.k) * t
  out.dy = a.dy + (b.dy - a.dy) * t
  return out
}

/** What a car needs to know about the others to avoid them. */
export interface Other { D: number; d: number; v: number }

export class AiCar {
  /** distance driven from the start line (negative on the grid), metres */
  D: number
  v = 0
  /** lateral offset from the centre line (right positive) and its rate */
  d: number
  vlat = 0
  readonly lane: number
  // pose for rendering
  x = 0; y = 0; z = 0; yaw = 0; pitch = 0; roll = 0
  // animation inputs (same names as the player's VehicleState)
  wheelRot = 0; steerAngle = 0; steerInput = 0; gLong = 0; gLat = 0
  brake = 0; throttle = 0
  finished = false
  finishTime = 0
  /** Rapier body used so the player collides with this car */
  body: { setNextKinematicTranslation(t: { x: number; y: number; z: number }): void; setNextKinematicRotation(q: { x: number; y: number; z: number; w: number }): void } | null = null
  private aPrev = 0

  constructor(readonly spec: DriverSpec, D0: number, lane: number) {
    this.D = D0
    this.d = lane
    this.lane = lane
    this.placeNow(0)
  }

  get speed() { return this.v }

  /** @param go false while the cars sit on the grid */
  step(dt: number, go: boolean, paceMul: number, others: readonly Other[]) {
    if (go) {
      const look = Math.min(40, this.v * 0.3)
      let vt = profileAt(this.D + look) * this.spec.pace * paceMul
      let shift = 0
      for (const o of others) {
        const gap = o.D - this.D
        const closing = this.v - o.v
        // start moving over early enough for the closing speed
        const reach = 30 + Math.max(0, closing) * 2.2
        const overlapLat = Math.abs(o.d - this.d)
        if (gap > 0.5 && gap < reach && overlapLat < 2.6) {
          // only brake if the gap is closing faster than it can be shed comfortably
          const needed = closing > 0 ? (closing * closing) / 40 : 0
          if (gap - 8 < needed) vt = Math.min(vt, o.v * 0.97)
          else if (gap < 9) vt = Math.min(vt, o.v + (gap - 9) * 0.5)
          const side = o.d > this.d ? -1 : o.d < this.d ? 1 : this.d > 0 ? -1 : 1
          shift = side * 2.9
        } else if (Math.abs(gap) < 6 && overlapLat < 2.3) {
          // side by side: keep apart
          shift += (this.d >= o.d ? 1 : -1) * 1.4
        }
      }
      const a = this.v < vt ? Math.min(accelCap(this.v), (vt - this.v) * 3 + 0.5) : -Math.min(BRAKE + 2, (this.v - vt) * 4 + 2)
      this.aPrev += (a - this.aPrev) * Math.min(1, dt * 12)
      this.v = Math.max(0, this.v + a * dt)
      this.D += this.v * dt

      const c = roadAt(this.D)
      const line = Math.max(-0.62, Math.min(0.62, c.k * 70)) * TRACK_HALF_WIDTH * 0.55
      const target = Math.max(-(TRACK_HALF_WIDTH - 1.7), Math.min(TRACK_HALF_WIDTH - 1.7, this.lane * 0.65 + line + shift))
      const want = Math.max(-3.5, Math.min(3.5, (target - this.d) * 1.2))
      this.vlat += (want - this.vlat) * Math.min(1, dt * 3)
      this.d += this.vlat * dt
      this.wheelRot += (this.v / CAR.wheelRadius) * dt
    } else {
      this.vlat = 0
    }
    this.placeNow(dt)
  }

  private placeNow(dt: number) {
    const c = roadAt(this.D)
    this.x = c.x - c.tz * this.d
    this.z = c.z + c.tx * this.d
    this.y = c.y
    // heading: along the road, turned towards the direction of lateral movement
    const v = Math.max(this.v, 1)
    const hx = c.tx * v + -c.tz * this.vlat
    const hz = c.tz * v + c.tx * this.vlat
    this.yaw = Math.atan2(-hz, hx)
    this.pitch = Math.atan(c.dy)
    const steer = Math.atan(c.k * CAR.wheelbase) + Math.atan2(this.vlat, v) * 0.5
    this.steerAngle = Math.max(-0.4, Math.min(0.4, steer))
    this.steerInput = this.steerAngle / 0.4
    this.gLat = (this.v * this.v * c.k) / G
    this.gLong = this.aPrev / G
    this.brake = this.aPrev < -3 ? Math.min(1, -this.aPrev / 18) : 0
    this.throttle = this.aPrev > 0.5 ? 1 : 0
    if (this.body) {
      this.body.setNextKinematicTranslation({ x: this.x, y: 0, z: this.z })
      this.body.setNextKinematicRotation({ x: 0, y: Math.sin(this.yaw / 2), z: 0, w: Math.cos(this.yaw / 2) })
    }
    void dt
  }
}

export { SAMPLE_SPACING }
