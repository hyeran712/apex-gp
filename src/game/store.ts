/** UI-facing state. Per-frame telemetry is read straight from `game` instead. */
import { create } from 'zustand'
import { IS_TOUCH_DEVICE } from './device'
import type { EngineSound } from './audio/AudioEngine'
import type { QualityName } from './quality'
import type { Difficulty } from './race/drivers'

export type Phase = 'loading' | 'menu' | 'countdown' | 'racing' | 'paused' | 'finished'
export type Mode = 'trial' | 'race'

export interface ResultRow {
  pos: number; name: string; code: string; color: string; isPlayer: boolean
  /** race time at the flag (s) */
  time: number
  /** seconds behind the car in front (null for the winner) */
  gap: number | null
  /** still running when the player finished: time is projected */
  estimated: boolean
}
export const CAMERA_NAMES = ['CHASE', 'COCKPIT', 'NOSE'] as const

export interface Toast { id: number; text: string; sub?: string; tone: 'good' | 'bad' | 'info' | 'best' }

interface Settings {
  quality: QualityName; volume: number; adaptive: boolean; engineSound: EngineSound
  mode: Mode; raceLaps: number; difficulty: Difficulty
}
const SETTINGS_KEY = 'apex-gp:settings:v1'

function loadSettings(): Settings {
  // phones start on the lightest preset; it can be raised in the menu
  const def: Settings = { quality: IS_TOUCH_DEVICE ? 'low' : 'high', volume: 0.8, adaptive: true, engineSound: 'v6', mode: 'trial', raceLaps: 3, difficulty: 'normal' }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...def, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return def
}

interface Store extends Settings {
  phase: Phase
  /** phase to return to when unpausing */
  resumePhase: Phase
  camera: number
  /** start lights lit, 0-5 */
  lights: number
  toast: Toast | null
  loadProgress: number
  loadLabel: string
  placeholderCar: boolean
  /** bumped on every (re)start so the opponents' meshes are rebuilt */
  raceId: number
  results: ResultRow[] | null
  /** show on-screen touch controls (touch device, or a touch was seen) */
  touch: boolean
  /** current adaptive resolution scale 0..1 within the preset's DPR range */
  resScale: number
  set: (p: Partial<Store>) => void
  setSetting: (p: Partial<Settings>) => void
  showToast: (t: Omit<Toast, 'id'>) => void
}

let toastId = 0
export const useStore = create<Store>((set, get) => ({
  ...loadSettings(),
  phase: 'loading',
  resumePhase: 'racing',
  camera: 0,
  lights: 0,
  toast: null,
  loadProgress: 0,
  loadLabel: 'Starting',
  placeholderCar: true,
  raceId: 0,
  results: null,
  touch: IS_TOUCH_DEVICE,
  resScale: 1,
  set: p => set(p),
  setSetting: p => {
    set(p)
    const { quality, volume, adaptive, engineSound, mode, raceLaps, difficulty } = get()
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ quality, volume, adaptive, engineSound, mode, raceLaps, difficulty })) } catch { /* ignore */ }
  },
  showToast: t => set({ toast: { ...t, id: ++toastId } }),
}))
