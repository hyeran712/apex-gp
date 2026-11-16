/**
 * Simple pure-pursuit driver. Used by the headless simulation test and by the
 * `?autopilot` URL flag to verify that the circuit is drivable end to end.
 */
import { track } from '../track/trackData'
import type { VehicleInput, VehicleState } from './vehiclePhysics'

/**
 * Speed (m/s) the car can carry right now and still make the corners ahead,
 * from the tightest curvature inside the braking window. Deliberately a
 * little conservative; also drives the HUD's BRAKE prompt.
 */
export function targetSpeed(s: VehicleState): number {
  const { samples, count } = track
  let vTarget = 100
  const window = Math.round((20 + (s.speed * s.speed) / 38) / 2)
  for (let j = 0; j <= window; j++) {
    const k = Math.abs(samples[(s.loc.index + j) % count].k)
    if (k < 1e-4) continue
    const dist = j * 2
    // lateral limit ~ 1.5 g mechanical + aero; solve v^2 k = a(v) conservatively
    const vCorner = Math.sqrt((1.45 * 9.81) / Math.max(1e-4, k - 1.45 * 0.0028))
    const vc = isFinite(vCorner) && vCorner > 0 ? vCorner : 100
    // speed we may carry now and still brake to vc in `dist` at ~3 g
    const vAllowed = Math.sqrt(vc * vc + 2 * 28 * dist)
    vTarget = Math.min(vTarget, vAllowed)
  }
  return vTarget
}

/**
 * Should the HUD tell the driver to brake? True from roughly a second before
 * the last possible braking point of a corner that needs a real speed drop
 * (not for corners that can be taken with a lift).
 */
export function shouldBrake(s: VehicleState): boolean {
  if (s.vx < 22) return false
  const { samples, count } = track
  // look further ahead than the braking distance itself: reaction time at speed
  const lead = s.speed * 0.9
  const window = Math.round((40 + lead + (s.speed * s.speed) / 38) / 2)
  for (let j = 0; j <= window; j++) {
    const k = Math.abs(samples[(s.loc.index + j) % count].k)
    if (k < 1e-4) continue
    const vCorner = Math.sqrt((1.45 * 9.81) / Math.max(1e-4, k - 1.45 * 0.0028))
    if (!isFinite(vCorner) || s.speed - vCorner < 12) continue
    const dist = Math.max(0, j * 2 - lead)
    if (s.speed > Math.sqrt(vCorner * vCorner + 2 * 28 * dist)) return true
  }
  return false
}

export function autopilot(s: VehicleState, out: VehicleInput): VehicleInput {
  const { samples, count } = track
  const look = Math.round((9 + s.speed * 0.32) / 2)
  const target = samples[(s.loc.index + look) % count]
  const fx = Math.cos(s.yaw), fz = -Math.sin(s.yaw)
  const dx = target.x - s.x, dz = target.z - s.z
  const ahead = dx * fx + dz * fz
  const side = dx * -fz + dz * fx
  const angle = Math.atan2(side, ahead)
  out.steer = Math.max(-1, Math.min(1, angle * 5))

  const vTarget = targetSpeed(s)
  const err = vTarget - s.speed
  out.throttle = err > 0 ? 1 : 0
  out.brake = err < -1.5 ? 1 : 0
  out.hardBrake = false
  return out
}
