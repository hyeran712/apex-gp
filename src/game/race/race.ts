/** Race session: the grid, the AI field, positions and finishing. No rendering. */
import { track } from '../track/trackData'
import { AiCar, wrapS, type Other } from './ai'
import { AI_DRIVERS, DIFFICULTY_SCALE, PLAYER_DRIVER, type Difficulty, type DriverSpec } from './drivers'

export interface Standing {
  id: string
  pos: number
  name: string
  code: string
  color: string
  number: string
  isPlayer: boolean
  D: number
  lap: number
  /** seconds to the car in front (null for the leader) */
  gap: number | null
  finished: boolean
  /** race time at the flag, seconds (an estimate when `estimated`) */
  finishTime: number | null
  estimated: boolean
}

export interface PlayerInfo { s: number; d: number; v: number }

const GRID_FIRST = 10
const GRID_STEP = 9

export class Race {
  readonly cars: AiCar[]
  readonly total: number
  readonly playerSlot: number
  playerD: number
  playerFinishTime: number | null = null
  /** seconds since the lights went out */
  time = 0
  private prevS: number
  private started = false
  private others: Other[] = []

  constructor(readonly laps: number, difficulty: Difficulty, total: number, playerS: number) {
    this.total = total
    this.playerSlot = Math.min(5, total - 2)
    const scale = DIFFICULTY_SCALE[difficulty]
    const field = AI_DRIVERS.slice(0, total - 1)
    this.cars = []
    let ai = 0
    for (let slot = 0; slot < total; slot++) {
      if (slot === this.playerSlot) continue
      const spec: DriverSpec = { ...field[ai++], pace: 0 }
      spec.pace = field[ai - 1].pace * scale
      this.cars.push(new AiCar(spec, -Race.gridDistance(slot), Race.gridLateral(slot)))
    }
    this.playerD = -Race.gridDistance(this.playerSlot)
    this.prevS = playerS
  }

  static gridDistance(slot: number) { return GRID_FIRST + GRID_STEP * slot }
  static gridLateral(slot: number) { return slot % 2 === 0 ? -2.8 : 2.8 }

  /** Advance all AI cars one fixed step. */
  step(dt: number, player: PlayerInfo, go: boolean) {
    // unwrap the player's distance
    let ds = player.s - this.prevS
    const L = track.length
    if (ds > L / 2) ds -= L
    else if (ds < -L / 2) ds += L
    this.prevS = player.s
    this.playerD += ds
    if (go) { this.started = true; this.time += dt }

    const all = this.others
    all.length = 0
    all.push({ D: this.playerD, d: player.d, v: player.v })
    for (const c of this.cars) all.push(c)
    for (const c of this.cars) {
      // gentle catch-up so the race stays close without teleporting anyone
      const mul = 1 + Math.max(-0.03, Math.min(0.03, (this.playerD - c.D) / 1800))
      c.step(dt, go, this.started ? mul : 1, all.filter(o => o !== c))
      if (!c.finished && c.D >= this.laps * L) {
        c.finished = true
        c.finishTime = Math.max(0, this.time - (c.D - this.laps * L) / Math.max(c.v, 1))
      }
    }
    if (this.playerFinishTime === null && this.playerD >= this.laps * L) {
      this.playerFinishTime = Math.max(0, this.time - (this.playerD - this.laps * L) / Math.max(player.v, 1))
    }
  }

  get playerFinished() { return this.playerFinishTime !== null }

  lapOf(D: number) { return Math.max(1, Math.min(this.laps, Math.floor(D / track.length) + 1)) }

  /** Full classification, best first. `playerV` is only used to estimate gaps. */
  standings(playerV: number): Standing[] {
    const L = track.length
    const rows: Standing[] = [{
      id: 'player', pos: 0, name: PLAYER_DRIVER.name, code: PLAYER_DRIVER.code, color: PLAYER_DRIVER.livery.primary,
      number: PLAYER_DRIVER.livery.number, isPlayer: true, D: this.playerD, lap: this.lapOf(this.playerD), gap: null,
      finished: this.playerFinished, finishTime: this.playerFinishTime, estimated: false,
    }]
    for (const c of this.cars) {
      const remaining = Math.max(0, this.laps * L - c.D)
      rows.push({
        id: c.spec.code, pos: 0, name: c.spec.name, code: c.spec.code, color: c.spec.livery.primary, number: c.spec.livery.number,
        isPlayer: false, D: c.D, lap: this.lapOf(c.D), gap: null, finished: c.finished,
        finishTime: c.finished ? c.finishTime : this.time + remaining / Math.max(c.v, 25), estimated: !c.finished,
      })
    }
    rows[0].finishTime ??= this.time + Math.max(0, this.laps * L - this.playerD) / Math.max(playerV, 25)
    if (!this.playerFinished) rows[0].estimated = true
    rows.sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1
      if (a.finished && b.finished) return (a.finishTime ?? 0) - (b.finishTime ?? 0)
      return b.D - a.D
    })
    rows.forEach((r, i) => {
      r.pos = i + 1
      if (i > 0) {
        const ahead = rows[i - 1]
        r.gap = ahead.finished && r.finished
          ? (r.finishTime ?? 0) - (ahead.finishTime ?? 0)
          : Math.max(0, ahead.D - r.D) / Math.max(playerV, 30)
      }
    })
    return rows
  }

  playerPosition(playerV: number) {
    return this.standings(playerV).find(r => r.isPlayer)!.pos
  }

  /** Distance of the start line the grid is measured from, for tests. */
  static startS() { return wrapS(0) }
}
