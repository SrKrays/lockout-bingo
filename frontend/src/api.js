import * as signalR from '@microsoft/signalr'

export const API_URL = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? 'https://lockout-bingo.onrender.com' : 'http://localhost:5080')
).replace(/\/$/, '')

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || `Error ${res.status}`)
  return data
}

export const api = {
  listTemplates: () => request('/api/templates'),
  getTemplate: (id) => request(`/api/templates/${id}`),
  createTemplate: (t) => request('/api/templates', { method: 'POST', body: JSON.stringify(t) }),
  updateTemplate: (id, t) => request(`/api/templates/${id}`, { method: 'PUT', body: JSON.stringify(t) }),
  deleteTemplate: (id) => request(`/api/templates/${id}`, { method: 'DELETE' }),

  createRoom: (r) => request('/api/rooms', { method: 'POST', body: JSON.stringify(r) }),
  getRoom: (code) => request(`/api/rooms/${encodeURIComponent(code)}`),
  joinRoom: (code, p) => request(`/api/rooms/${encodeURIComponent(code)}/players`, { method: 'POST', body: JSON.stringify(p) }),
}

export function createHub() {
  return new signalR.HubConnectionBuilder()
    .withUrl(`${API_URL}/hubs/room`)
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Warning)
    .build()
}

/** El "quién soy" en cada sala se guarda en el navegador. */
export const identity = {
  get(code) {
    try { return JSON.parse(localStorage.getItem(`lb:player:${code}`)) } catch { return null }
  },
  set(code, player) {
    try { localStorage.setItem(`lb:player:${code}`, JSON.stringify(player)) } catch { /* modo privado */ }
  },
  clear(code) {
    try { localStorage.removeItem(`lb:player:${code}`) } catch { /* modo privado */ }
  },
}

/** SignalR envuelve los HubException: dejamos sólo el mensaje en castellano. */
export function hubError(err) {
  const msg = err?.message || String(err)
  const m = msg.match(/HubException: (.*)$/)
  return m ? m[1] : msg
}
