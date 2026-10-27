import { forwardRef } from 'react'

/**
 * Tablero reutilizable: lo usa el editor (vista previa / PNG para imprimir) y la sala en vivo.
 * `owners` es un array del largo del tablero con el jugador dueño de cada casilla (o null).
 */
const BoardGrid = forwardRef(function BoardGrid(
  { title, subtitle, size, squares, owners = [], winningLine = [], onSquare, myId, disabled },
  ref,
) {
  const total = size * size
  const cells = Array.from({ length: total }, (_, i) => squares[i] ?? '')
  const lineSet = new Set(winningLine)

  return (
    <div className="board-card" ref={ref}>
      {(title || subtitle) && (
        <header className="board-head">
          {title && <h2>{title}</h2>}
          {subtitle && <p>{subtitle}</p>}
        </header>
      )}
      <div className="board" style={{ '--n': size }}>
        {cells.map((text, i) => {
          const owner = owners[i]
          const mine = owner && owner.id === myId
          const classes = ['cell']
          if (owner) classes.push('claimed')
          if (mine) classes.push('mine')
          if (lineSet.has(i)) classes.push('in-line')
          if (!text) classes.push('empty')
          const interactive = onSquare && text && !disabled && (!owner || mine)
          return (
            <button
              key={i}
              type="button"
              className={classes.join(' ')}
              style={owner ? { '--owner': owner.color } : undefined}
              onClick={interactive ? () => onSquare(i) : undefined}
              disabled={!interactive}
              title={owner ? `${owner.name}${mine ? ' (vos) — click para desmarcar' : ''}` : text}
              aria-label={owner ? `${text} — de ${owner.name}` : text || 'Casilla vacía'}
            >
              <span className="cell-text">{text || '—'}</span>
              {owner && <span className="cell-owner">{owner.name}</span>}
            </button>
          )
        })}
      </div>
      <footer className="board-foot">lockout bingo</footer>
    </div>
  )
})

export default BoardGrid
