import { toPng } from 'html-to-image'

export function slug(text) {
  return (text || 'tablero')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tablero'
}

function triggerDownload(href, filename) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Descarga un nodo del DOM como PNG en alta resolución. */
export async function downloadPng(node, name) {
  const opts = { pixelRatio: 2, backgroundColor: getComputedStyle(document.body).backgroundColor, cacheBust: true }
  let dataUrl
  try {
    dataUrl = await toPng(node, opts)
  } catch {
    // Si falla al incrustar la tipografía externa, exporta con la del sistema.
    dataUrl = await toPng(node, { ...opts, skipFonts: true })
  }
  triggerDownload(dataUrl, `${slug(name)}.png`)
}

/** Formato de archivo de tablero: sirve para guardarlo, pasárselo a un amigo y volver a importarlo. */
export const BOARD_FILE_VERSION = 1

export function downloadBoardJson({ name, description = '', size, winCondition, goals }) {
  const data = { app: 'lockout-bingo', version: BOARD_FILE_VERSION, name, description, size, winCondition, goals }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  triggerDownload(url, `${slug(name)}.bingo.json`)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function readBoardFile(file) {
  const text = await file.text()
  let data
  try { data = JSON.parse(text) } catch { throw new Error('El archivo no es un JSON válido.') }

  // Acepta también una lista simple: ["objetivo 1", "objetivo 2", ...]
  if (Array.isArray(data)) data = { goals: data }
  if (!Array.isArray(data.goals)) throw new Error('El archivo no tiene una lista de objetivos ("goals").')

  return {
    name: typeof data.name === 'string' ? data.name : file.name.replace(/\.(bingo\.)?json$/i, ''),
    description: typeof data.description === 'string' ? data.description : '',
    size: [3, 4, 5, 6, 7].includes(data.size) ? data.size : 5,
    winCondition: ['lockout', 'line', 'blackout'].includes(data.winCondition) ? data.winCondition : 'lockout',
    goals: data.goals.filter((g) => typeof g === 'string').map((g) => g.trim()).filter(Boolean),
  }
}

export function parseGoals(text) {
  return [...new Set(text.split('\n').map((l) => l.trim()).filter(Boolean))]
}
