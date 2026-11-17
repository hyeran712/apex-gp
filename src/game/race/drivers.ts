/** Fictional drivers and liveries for the race field (no real teams or people). */
export interface Livery { primary: string; accent: string; dark: string; number: string }

export interface DriverSpec {
  name: string
  code: string
  /** base pace, 0..1 of the speed the track allows (before the difficulty setting) */
  pace: number
  livery: Livery
}

export const PLAYER_DRIVER: DriverSpec = {
  name: 'You', code: 'YOU', pace: 1,
  livery: { primary: '#123c9c', accent: '#ff5a1f', dark: '#0b0c0f', number: '7' },
}

/** Strongest first; they are placed on the grid in this order around the player. */
export const AI_DRIVERS: DriverSpec[] = [
  { name: 'L. Moreau', code: 'MOR', pace: 0.985, livery: { primary: '#c8161d', accent: '#f4f4f2', dark: '#0b0c0f', number: '1' } },
  { name: 'S. Tanaka', code: 'TAN', pace: 0.975, livery: { primary: '#f2f2ee', accent: '#d7262b', dark: '#101216', number: '14' } },
  { name: 'R. Okafor', code: 'OKA', pace: 0.965, livery: { primary: '#0f6b46', accent: '#f2c318', dark: '#0b0c0f', number: '22' } },
  { name: 'M. Brandt', code: 'BRA', pace: 0.955, livery: { primary: '#f2c318', accent: '#151515', dark: '#0b0c0f', number: '33' } },
  { name: 'A. Reyes', code: 'REY', pace: 0.945, livery: { primary: '#5a1fa8', accent: '#28e0b0', dark: '#0b0c0f', number: '44' } },
  { name: 'J. Solano', code: 'SOL', pace: 0.935, livery: { primary: '#e87a1c', accent: '#1b1d22', dark: '#0b0c0f', number: '55' } },
  { name: 'V. Hale', code: 'HAL', pace: 0.925, livery: { primary: '#14171c', accent: '#d9b21c', dark: '#050506', number: '77' } },
]

export type Difficulty = 'easy' | 'normal' | 'hard'
export const DIFFICULTY_SCALE: Record<Difficulty, number> = { easy: 0.88, normal: 0.96, hard: 1.04 }
