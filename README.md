# Lockout Bingo

Bingo competitivo para jugar con amigos: armás un tablero con tus propios desafíos, pasás el código de sala y **el primero que cumple una casilla se la queda** — nadie más la puede marcar.

- **Frontend:** React + Vite (`frontend/`)
- **Backend:** .NET 9 minimal API + SignalR (`backend/`)
- **Base:** PostgreSQL (EF Core / Npgsql)

## Qué hace

- **Editor de tableros** — 3×3 a 7×7, objetivos uno por línea, vista previa en vivo, botón para mezclar.
- **Plantillas** — guardás pools de objetivos en la base y los reusás. Vienen 3 de arranque (Minecraft, Valorant, Juntada).
- **Descargar** — PNG del tablero (alta resolución, para imprimir o mandar por WhatsApp) y JSON para guardarlo o pasárselo a alguien.
- **Importar** — un `.bingo.json` exportado o una lista simple `["objetivo 1", "objetivo 2", …]`.
- **Salas en vivo** — hasta 8 jugadores, cada uno con su color, todo sincronizado por SignalR.
- **3 modos de victoria**
  - *Lockout:* ganás cuando nadie te puede alcanzar aunque se lleve todas las casillas libres.
  - *Línea:* primera fila, columna o diagonal completa (se resalta).
  - *Tablero lleno:* cuando no queda nada libre, gana el que más tiene.
- **Revancha** — limpia el tablero y mezcla las casillas.

El "lockout" lo garantiza la base: hay un índice único sobre `(RoomCode, Index)` en la tabla `claims`, así que si dos personas tocan la misma casilla en el mismo milisegundo, sólo entra la primera y la otra recibe "¡Tarde!".

## Correrlo local

Necesitás .NET 9 SDK, Node 20+ y PostgreSQL.

```bash
# 1. Backend (crea la base y las tablas solo al arrancar)
cd backend
# editá ConnectionStrings:Default en appsettings.json si tu usuario/clave no es postgres/postgres
dotnet run            # → http://localhost:5080

# 2. Frontend
cd frontend
cp .env.example .env  # VITE_API_URL=http://localhost:5080
npm install
npm run dev           # → http://localhost:5173
```

Para probar multijugador en tu máquina abrí la sala en una ventana normal y otra de incógnito (la identidad de cada jugador se guarda en `localStorage`).

## Deploy (Render + Vercel)

**Backend en Render** — Render no tiene runtime .NET nativo, por eso va con el `Dockerfile` incluido.

1. Subí el repo a GitHub.
2. En Render: *New → Blueprint* y elegí el repo; `render.yaml` crea la API y la base Postgres gratis y conecta `DATABASE_URL` sola.
3. Cuando tengas la URL de Vercel, cargala en la variable `AllowedOrigins` del servicio (separá varias con coma).

**Frontend en Vercel**

1. *New Project* → mismo repo, **Root Directory: `frontend`**.
2. Variable `VITE_API_URL` = URL de la API en Render (sin barra final).
3. `vercel.json` ya tiene el rewrite para que `/sala/XXXX` funcione al recargar.

> En el plan free de Render la API se duerme tras 15 min sin uso; la primera carga tarda ~30-50 s en despertar.

## API

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/templates` | Lista plantillas |
| GET / PUT / DELETE | `/api/templates/{id}` | Ver / editar / borrar |
| POST | `/api/templates` | `{ name, description, goals[] }` |
| POST | `/api/rooms` | `{ name, goals[], size, winCondition, shuffle }` → estado de la sala |
| GET | `/api/rooms/{code}` | Estado actual |
| POST | `/api/rooms/{code}/players` | `{ name, color }` → jugador |

**Hub `/hubs/room`:** `JoinRoom(code)`, `Claim(code, playerId, index)`, `Unclaim(code, playerId, index)`, `Reset(code, reshuffle)`. Cada cambio emite `State` con el estado completo a toda la sala.

## Formato `.bingo.json`

```json
{
  "app": "lockout-bingo",
  "version": 1,
  "name": "Minecraft Lockout",
  "description": "",
  "size": 5,
  "winCondition": "lockout",
  "goals": ["Conseguir un diamante", "Matar un creeper", "..."]
}
```

## Ideas para seguir

- Modo equipos (varios jugadores comparten color).
- Timer de partida y log de quién marcó qué y cuándo.
- Contraseña de sala o "host" que es el único que puede hacer revancha.
- Migraciones de EF en vez de `EnsureCreated` si el esquema empieza a cambiar.
