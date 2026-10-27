import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import BoardGrid from '../components/BoardGrid'
import { WIN_LABELS } from '../lib/labels'
import { downloadBoardJson, downloadPng, parseGoals, readBoardFile } from '../lib/files'

const SIZES = [3, 4, 5, 6, 7]

function shuffle(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function Editor() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const templateId = params.get('plantilla')

  const [name, setName] = useState('Mi lockout')
  const [description, setDescription] = useState('')
  const [size, setSize] = useState(5)
  const [winCondition, setWinCondition] = useState('lockout')
  const [goalsText, setGoalsText] = useState('')
  const [order, setOrder] = useState([]) // orden mezclado que se ve en la vista previa
  const [templates, setTemplates] = useState([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState({ type: '', text: '' })
  const boardRef = useRef(null)
  const fileRef = useRef(null)

  const goals = useMemo(() => parseGoals(goalsText), [goalsText])
  const needed = size * size

  // Mantiene el orden de la vista previa sincronizado con los objetivos actuales.
  useEffect(() => {
    setOrder((prev) => {
      const set = new Set(goals)
      const kept = prev.filter((g) => set.has(g))
      const keptSet = new Set(kept)
      return [...kept, ...goals.filter((g) => !keptSet.has(g))]
    })
  }, [goals])

  useEffect(() => { api.listTemplates().then(setTemplates).catch(() => {}) }, [])

  useEffect(() => {
    if (!templateId) return
    api.getTemplate(templateId)
      .then((t) => {
        setName(t.name)
        setDescription(t.description)
        setGoalsText(t.goals.join('\n'))
        setOrder(shuffle(t.goals))
      })
      .catch(() => flash('error', 'No se pudo cargar la plantilla.'))
  }, [templateId])

  const squares = order.slice(0, needed)

  function flash(type, text) {
    setMsg({ type, text })
    if (type === 'ok') setTimeout(() => setMsg((m) => (m.text === text ? { type: '', text: '' } : m)), 2500)
  }

  async function onImport(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const b = await readBoardFile(file)
      setParams({})
      setName(b.name)
      setDescription(b.description)
      setSize(b.size)
      setWinCondition(b.winCondition)
      setGoalsText(b.goals.join('\n'))
      setOrder(b.goals) // respeta el orden del archivo
      flash('ok', `Importado: ${b.goals.length} objetivos.`)
    } catch (err) {
      flash('error', err.message)
    }
  }

  async function saveTemplate(asNew) {
    setBusy(true)
    try {
      const body = { name, description, goals }
      const saved = templateId && !asNew ? await api.updateTemplate(templateId, body) : await api.createTemplate(body)
      setParams({ plantilla: saved.id })
      setTemplates(await api.listTemplates())
      flash('ok', 'Plantilla guardada.')
    } catch (err) {
      flash('error', err.message)
    } finally {
      setBusy(false)
    }
  }

  async function removeTemplate() {
    if (!templateId || !confirm(`¿Borrar la plantilla "${name}"? No se puede deshacer.`)) return
    await api.deleteTemplate(templateId)
    setParams({})
    setTemplates(await api.listTemplates())
    flash('ok', 'Plantilla borrada.')
  }

  async function createRoom() {
    setBusy(true)
    try {
      // Mandamos el orden de la vista previa: la sala queda igual a lo que estás viendo.
      const room = await api.createRoom({ name, goals: squares, size, winCondition, shuffle: false })
      navigate(`/sala/${room.code}`)
    } catch (err) {
      flash('error', err.message)
      setBusy(false)
    }
  }

  const enough = goals.length >= needed

  return (
    <main className="editor">
      <div className="editor-top">
        <Link to="/" className="link">← Inicio</Link>
        <select
          value={templateId || ''}
          onChange={(e) => setParams(e.target.value ? { plantilla: e.target.value } : {})}
          aria-label="Cargar plantilla"
        >
          <option value="">Cargar plantilla…</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.goalCount})</option>)}
        </select>
      </div>

      <div className="editor-grid">
        <section className="panel">
          <label className="field">
            <span>Nombre</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </label>
          <label className="field">
            <span>Descripción <small>(opcional)</small></span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="Reglas de la casa, seed, etc." />
          </label>

          <div className="field">
            <span>Tamaño</span>
            <div className="seg">
              {SIZES.map((s) => (
                <button key={s} type="button" className={s === size ? 'on' : ''} onClick={() => setSize(s)}>
                  {s}×{s}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span>Cómo se gana</span>
            <div className="seg seg-col">
              {Object.entries(WIN_LABELS).map(([k, label]) => (
                <button key={k} type="button" className={k === winCondition ? 'on' : ''} onClick={() => setWinCondition(k)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="field grow">
            <span>
              Objetivos <small>(uno por línea)</small>
              <b className={enough ? 'count ok' : 'count'}>{goals.length} / {needed}</b>
            </span>
            <textarea
              value={goalsText}
              onChange={(e) => setGoalsText(e.target.value)}
              placeholder={'Conseguir un diamante\nMatar un creeper\nDomesticar un lobo\n…'}
              spellCheck={false}
            />
          </label>
          {!enough && (
            <p className="muted small">
              Te faltan {needed - goals.length} para un {size}×{size}. Si ponés más de {needed}, cada partida sale distinta al mezclar.
            </p>
          )}

          <div className="row wrap">
            <button className="btn" type="button" onClick={() => fileRef.current?.click()}>Importar JSON</button>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onImport} />
            <button className="btn" type="button" disabled={!goals.length}
              onClick={() => downloadBoardJson({ name, description, size, winCondition, goals: order })}>
              Descargar JSON
            </button>
            <button className="btn" type="button" disabled={busy || goals.length < 9} onClick={() => saveTemplate(false)}>
              {templateId ? 'Guardar cambios' : 'Guardar plantilla'}
            </button>
            {templateId && <button className="btn" type="button" disabled={busy} onClick={() => saveTemplate(true)}>Guardar como nueva</button>}
            {templateId && <button className="btn btn-danger" type="button" onClick={removeTemplate}>Borrar</button>}
          </div>
          {msg.text && <p className={msg.type === 'error' ? 'error' : 'ok-msg'}>{msg.text}</p>}
        </section>

        <section className="preview">
          <BoardGrid ref={boardRef} title={name} subtitle={WIN_LABELS[winCondition]} size={size} squares={squares} />
          <div className="row wrap center">
            <button className="btn" type="button" disabled={goals.length < 2} onClick={() => setOrder(shuffle(goals))}>🔀 Mezclar</button>
            <button className="btn" type="button" disabled={!squares.length}
              onClick={() => downloadPng(boardRef.current, name)}>
              Descargar PNG
            </button>
            <button className="btn btn-primary" type="button" disabled={!enough || busy} onClick={createRoom}>
              Crear sala y jugar →
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
