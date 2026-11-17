import { useState } from 'react'
import { IS_TOUCH_DEVICE, requestImmersive } from '../game/device'
import { game } from '../game/game'
import { useStore } from '../game/store'
import { DIFFICULTY_SCALE, type Difficulty } from '../game/race/drivers'
import { formatTime } from '../game/timing/lapTimer'
import { TRACKS, selectTrack, track, trackDef } from '../game/track/trackData'
import { Controls, Settings } from './Settings'

export function MainMenu() {
  const placeholder = useStore(s => s.placeholderCar)
  const mode = useStore(s => s.mode)
  const raceLaps = useStore(s => s.raceLaps)
  const difficulty = useStore(s => s.difficulty)
  const setSetting = useStore(s => s.setSetting)
  const [best, setBest] = useState(game.timer.best)
  return (
    <div className="menu">
      <div className="menu-panel">
        <div className="brand"><span className="brand-mark" />APEX<b>GP</b></div>
        <div className="menu-sub">TIME TRIAL</div>
        <div className="field">
          <label>Circuit</label>
          <div className="circuits" role="radiogroup" aria-label="Circuit">
            {TRACKS.map(t => (
              <button key={t.id} role="radio" aria-checked={t.id === trackDef.id} className={t.id === trackDef.id ? 'on' : ''}
                onClick={() => { if (t.id !== trackDef.id) selectTrack(t.id) }}>
                <b>{t.name}</b><span>{t.blurb}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Mode</label>
          <div className="segmented two" role="radiogroup" aria-label="Mode">
            {([['trial', 'Time trial'], ['race', 'Race']] as const).map(([id, label]) => (
              <button key={id} role="radio" aria-checked={mode === id} className={mode === id ? 'on' : ''} onClick={() => setSetting({ mode: id })}>{label}</button>
            ))}
          </div>
          {mode === 'race' && (
            <>
              <div className="segmented three" role="radiogroup" aria-label="Laps">
                {[3, 5, 10].map(n => (
                  <button key={n} role="radio" aria-checked={raceLaps === n} className={raceLaps === n ? 'on' : ''} onClick={() => setSetting({ raceLaps: n })}>{n} laps</button>
                ))}
              </div>
              <div className="segmented three" role="radiogroup" aria-label="Difficulty">
                {(Object.keys(DIFFICULTY_SCALE) as Difficulty[]).map(d => (
                  <button key={d} role="radio" aria-checked={difficulty === d} className={difficulty === d ? 'on' : ''} onClick={() => setSetting({ difficulty: d })}>{d}</button>
                ))}
              </div>
              <div className="hint">{IS_TOUCH_DEVICE ? '6' : '8'} cars · you start 6th on the grid</div>
            </>
          )}
        </div>
        <div className="menu-track">
          <div><span>Length</span><b>{(track.length / 1000).toFixed(3)} km</b></div>
          <div><span>Personal best</span><b className="mono">{formatTime(best?.time)}</b></div>
        </div>
        <button className="btn primary" autoFocus onClick={() => { if (IS_TOUCH_DEVICE) requestImmersive(); game.startRace() }}>{mode === 'race' ? 'Start race' : 'Start session'}</button>
        <Settings />
        <Controls />
        <div className="menu-foot">
          {best && <button className="link" onClick={() => { game.clearBestLap(); setBest(null) }}>Clear saved best lap</button>}
          {placeholder && <span>Car model: built-in procedural stand-in (see ASSETS.md to use a GLB).</span>}
        </div>
      </div>
    </div>
  )
}
