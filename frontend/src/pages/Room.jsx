import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, createHub, hubError, identity } from '../api'
import BoardGrid from '../components/BoardGrid'
import { WIN_LABELS } from '../lib/labels'
import { downloadBoardJson, downloadPng } from '../lib/files'

const COLORS = ['#ff4d6d', '#4cc9f0', '#80ed99', '#ffd23f', '#b388ff', '#ff9f1c', '#f15bb5', '#e9ecef']

export default function Room() {
  const { code: rawCode } = useParams()
  const code = rawCode.toUpperCase()
  const [state, setState] = useState(null)
  const [conn, setConn] = useState('connecting') // connecting | online | reconnecting | error
  const [fatal, setFatal] = useState('')
  const [toast, setToast] = useState('')
  const [me, setMe] = useState(() => identity.get(code))
  const hubRef = useRef(null)
  const boardRef = useRef(null)
  const toastTimer = useRef(null)

  const notify = useCallback((text) => {
    setToast(text)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2800)
  }, [])

  useEffect(() => {
    const hub = createHub()
    hubRef.current = hub
    hub.on('State', setState)
    hub.onreconnecting(() => setConn('reconnecting'))
    hub.onreconnected(async () => {
      setConn('online')
      try { setState(await hub.invoke('JoinRoom', code)) } catch { /* el próximo State lo arregla */ }
    })
    hub.onclose(() => setConn('error'))

    let cancelled = false
    hub.start()
      .then(() => hub.invoke('JoinRoom', code))
      .then((s) => { if (!cancelled) { setState(s); setConn('online') } })
      .catch((err) => { if (!cancelled) { setFatal(hubError(err)); setConn('error') } })

    return () => { cancelled = true; hub.stop() }
  }, [code])

  // Si me borraron (ej: base reiniciada), vuelvo a pedir nombre.
  const meInRoom = state && me && state.players.some((p) => p.id === me.id)
  useEffect(() => {
    if (state && me && !meInRoom) { identity.clear(code); setMe(null) }
  }, [state, me, meInRoom, code])

  const playersById = useMemo(() => Object.fromEntries((state?.players ?? []).map((p) => [p.id, p])), [state])
  const owners = useMemo(() => {
    const arr = Array((state?.size ?? 0) ** 2).fill(null)
    state?.claims.forEach((c) => { arr[c.index] = playersById[c.playerId] ?? null })
    return arr
  }, [state, playersById])

  async function onSquare(index) {
    if (!meInRoom) return notify('Primero sumate a la sala con tu nombre.')
    const owner = owners[index]
    try {
      await hubRef.current.invoke(owner ? 'Unclaim' : 'Claim', code, me.id, index)
    } catch (err) {
      notify(hubError(err))
    }
  }

  async function rematch() {
    if (!confirm('¿Revancha? Se borran todas las marcas y se mezclan las casillas.')) return
    try { await hubRef.current.invoke('Reset', code, true) } catch (err) { notify(hubError(err)) }
  }

  async function copyLink() {
    const url = `${location.origin}/sala/${code}`
    try { await navigator.clipboard.writeText(url); notify('Link copiado. Pasáselo a tus amigos.') } catch { notify(url) }
  }

  if (fatal) {
    return (
      <main className="center-page">
        <h2>Uh, no se pudo entrar</h2>
        <p className="muted">{fatal}</p>
        <Link to="/" className="btn">Volver al inicio</Link>
      </main>
    )
  }

  if (!state) return <main className="center-page"><p className="muted">Conectando a la sala {code}…</p></main>

  const winner = state.winnerId ? playersById[state.winnerId] : null
  const total = state.size * state.size
  const free = total - state.claims.length

  return (
    <main className="room">
      <div className="room-top">
        <Link to="/" className="link">← Inicio</Link>
        <div className="room-code">
          <span>Sala</span>
          <button onClick={copyLink} title="Copiar link">{code}</button>
        </div>
        <span className={`conn conn-${conn}`}>
          {conn === 'online' ? 'en vivo' : conn === 'reconnecting' ? 'reconectando…' : conn === 'error' ? 'desconectado' : 'conectando…'}
        </span>
      </div>

      {state.status !== 'playing' && (
        <div className="banner" style={winner ? { '--owner': winner.color } : undefined}>
          {winner ? <>🏆 <strong>{winner.name}</strong> ganó{winner.id === me?.id ? ' — ¡sos vos!' : ''}</> : <>🤝 Empate</>}
          <button className="btn btn-small" onClick={rematch}>Revancha</button>
        </div>
      )}

      <div className="room-grid">
        <section>
          <BoardGrid
            ref={boardRef}
            title={state.name}
            subtitle={WIN_LABELS[state.winCondition]}
            size={state.size}
            squares={state.squares}
            owners={owners}
            winningLine={state.winningLine}
            onSquare={onSquare}
            myId={meInRoom ? me.id : null}
            disabled={!meInRoom || state.status !== 'playing'}
          />
        </section>

        <aside className="sidebar">
          {!meInRoom && <JoinForm code={code} players={state.players} onJoined={(p) => { identity.set(code, p); setMe(p) }} />}

          <div className="panel">
            <h3>Jugadores <small>{free} libres de {total}</small></h3>
            {state.players.length === 0 && <p className="muted small">Nadie todavía. Sumate y pasá el código.</p>}
            <ul className="players">
              {[...state.players].sort((a, b) => b.count - a.count).map((p) => (
                <li key={p.id} style={{ '--owner': p.color }}>
                  <span className="dot" />
                  <span className="pname">{p.name}{p.id === me?.id && <em> (vos)</em>}</span>
                  <b>{p.count}</b>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel">
            <h3>Tablero</h3>
            <div className="row wrap">
              <button className="btn" onClick={copyLink}>Copiar link</button>
              <button className="btn" onClick={() => downloadPng(boardRef.current, `${state.name}-${code}`)}>Descargar PNG</button>
              <button className="btn" onClick={() => downloadBoardJson({ name: state.name, size: state.size, winCondition: state.winCondition, goals: state.squares })}>
                Descargar JSON
              </button>
              <button className="btn" onClick={rematch}>Revancha</button>
              <Link className="btn" to="/crear">Nuevo tablero</Link>
            </div>
            <p className="muted small">Click en una casilla para marcarla. Click en una tuya para desmarcarla si te equivocaste.</p>
          </div>
        </aside>
      </div>

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  )
}

function JoinForm({ code, players, onJoined }) {
  const taken = new Set(players.map((p) => p.color.toLowerCase()))
  const [name, setName] = useState('')
  const [color, setColor] = useState(() => COLORS.find((c) => !taken.has(c)) ?? COLORS[0])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Si alguien agarra mi color mientras elijo, salto al siguiente libre.
  useEffect(() => {
    if (taken.has(color)) setColor(COLORS.find((c) => !taken.has(c)) ?? color)
  }, [players]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      onJoined(await api.joinRoom(code, { name, color }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="panel join-panel" onSubmit={submit}>
      <h3>Sumate</h3>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" maxLength={24} autoFocus />
      <div className="swatches" role="radiogroup" aria-label="Color">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={c === color}
            aria-label={c}
            className={c === color ? 'swatch on' : 'swatch'}
            style={{ background: c }}
            disabled={taken.has(c)}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      <button className="btn btn-primary" disabled={busy || !name.trim()}>Entrar a jugar</button>
      {error && <p className="error">{error}</p>}
    </form>
  )
}
