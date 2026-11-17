import { useEffect, useRef, useState } from 'react'
import { Vector3 } from 'three'
import { game } from '../game/game'
import { useStore } from '../game/store'
import { formatTime } from '../game/timing/lapTimer'
import type { Standing } from '../game/race/race'

const fmtGap = (g: number | null) => (g == null ? '' : `+${g.toFixed(1)}`)

/** Live classification (left side), like a broadcast timing tower. */
export function Tower() {
  const touch = useStore(s => s.touch)
  const [rows, setRows] = useState<Standing[]>([])
  useEffect(() => {
    const tick = () => { const r = game.race; if (r) setRows(r.standings(game.sim.state.speed)) }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [])
  const max = touch ? 5 : 8
  let view = rows
  if (rows.length > max) {
    const me = rows.findIndex(r => r.isPlayer)
    const start = Math.max(0, Math.min(rows.length - max, me - Math.floor(max / 2)))
    view = rows.slice(start, start + max)
  }
  return (
    <div className="tower" aria-label="Race positions">
      {view.map(r => (
        <div key={r.id} className={`trow${r.isPlayer ? ' me' : ''}`}>
          <b>{r.pos}</b><i style={{ background: r.color }} /><span>{r.code}</span>
          <em>{r.finished ? 'FIN' : r.pos === 1 ? '' : fmtGap(r.gap)}</em>
        </div>
      ))}
    </div>
  )
}

/** Floating "position + driver" tags above the opponents. */
export function NameTags() {
  const refs = useRef<(HTMLDivElement | null)[]>([])
  const raceId = useStore(s => s.raceId)
  const count = game.race?.cars.length ?? 0
  useEffect(() => {
    let raf = 0
    const v = new Vector3()
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const race = game.race, cam = game.camera
      if (!race || !cam) return
      const order = new Map(race.standings(game.sim.state.speed).map(r => [r.code, r.pos]))
      race.cars.forEach((c, i) => {
        const el = refs.current[i]
        if (!el) return
        v.set(c.x, c.y + 1.7, c.z)
        const dist = v.distanceTo(cam.position)
        v.project(cam)
        const x = (v.x * 0.5 + 0.5) * window.innerWidth
        const y = (-v.y * 0.5 + 0.5) * window.innerHeight
        const show = v.z < 1 && dist > 7 && dist < 170 && x > -40 && x < window.innerWidth + 40 && y > -20 && y < window.innerHeight
        el.style.display = show ? 'flex' : 'none'
        if (!show) return
        const k = Math.max(0.65, Math.min(1, 60 / dist + 0.3))
        el.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) translate(-50%, -100%) scale(${k.toFixed(2)})`
        const label = `${order.get(c.spec.code) ?? ''}`
        if (el.firstChild && el.firstChild.textContent !== label) el.firstChild.textContent = label
      })
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [raceId])
  return (
    <div className="tags" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const c = game.race!.cars[i]
        return (
          <div key={`${raceId}-${i}`} className="tag3d" ref={el => { refs.current[i] = el }} style={{ display: 'none' }}>
            <b style={{ background: c.spec.livery.primary }}>0</b><span>{c.spec.code}</span>
          </div>
        )
      })}
    </div>
  )
}

export function Results() {
  const results = useStore(s => s.results)
  const laps = game.race?.laps ?? 0
  if (!results) return null
  const me = results.find(r => r.isPlayer)!
  const ord = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4) % 4] ?? 'th'}`
  return (
    <div className="pause results" role="dialog" aria-label="Race results">
      <div className="menu-panel">
        <div className="pause-title">RACE FINISHED</div>
        <div className="res-pos"><b>{ord(me.pos)}</b><span>of {results.length} · {laps} lap{laps > 1 ? 's' : ''} · {formatTime(me.time)}</span></div>
        <div className="res-table">
          {results.map(r => (
            <div key={r.code} className={`res-row${r.isPlayer ? ' me' : ''}`}>
              <b>{r.pos}</b><i style={{ background: r.color }} /><span>{r.name}</span>
              <em>{r.pos === 1 ? formatTime(r.time) : `${r.estimated ? '~' : ''}+${Math.max(0, r.time - results[0].time).toFixed(1)}`}</em>
            </div>
          ))}
        </div>
        <button className="btn primary" autoFocus onClick={() => game.startRace()}>Race again</button>
        <button className="btn" onClick={() => game.quitToMenu()}>Main menu</button>
      </div>
    </div>
  )
}
