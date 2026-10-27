import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'

export default function Home() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [templates, setTemplates] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.listTemplates().then(setTemplates).catch(() => setTemplates([]))
  }, [])

  async function join(e) {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (clean.length < 4) return setError('Pegá el código de 6 letras que te pasaron.')
    try {
      await api.getRoom(clean)
      navigate(`/sala/${clean}`)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <main className="home">
      <section className="hero">
        <p className="eyebrow">bingo · pero se roba</p>
        <h1>Lockout<br />Bingo</h1>
        <p className="lede">
          Armá un tablero con tus propios desafíos, pasale el código a tus amigos y el primero que cumple
          una casilla se la queda. Nadie más la puede marcar.
        </p>
        <div className="hero-actions">
          <Link to="/crear" className="btn btn-primary">Crear tablero</Link>
          <form className="join" onSubmit={join}>
            <input
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setError('') }}
              placeholder="CÓDIGO"
              maxLength={8}
              aria-label="Código de sala"
              className="code-input"
            />
            <button className="btn">Entrar</button>
          </form>
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      <section className="templates">
        <div className="section-head">
          <h3>Plantillas guardadas</h3>
          <Link to="/crear" className="link">+ nueva</Link>
        </div>
        {templates === null && <p className="muted">Cargando…</p>}
        {templates?.length === 0 && <p className="muted">Todavía no hay plantillas. Creá la primera.</p>}
        <ul className="template-list">
          {templates?.map((t) => (
            <li key={t.id}>
              <Link to={`/crear?plantilla=${t.id}`}>
                <strong>{t.name}</strong>
                <span>{t.description}</span>
                <em>{t.goalCount} objetivos</em>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
