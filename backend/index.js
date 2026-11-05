import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { env } from './src/config.js'
import { authRouter, usuariosRouter } from './src/auth.js'
import { catalogosRouter } from './src/routes/catalogos.js'
import { solicitudesRouter } from './src/routes/solicitudes.js'
import { encargosRouter } from './src/routes/encargos.js'
import { panelRouter } from './src/routes/panel.js'
import { paquetesRouter } from './src/routes/paquetes.js'
import { requireAuth, requireRol } from './src/auth.js'
import { errorHandler } from './src/util.js'

const app = express()
app.set('trust proxy', 1)
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({ origin: [env.frontendUrl, /^http:\/\/localhost:\d+$/] }))
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/auth', authRouter)
app.use('/api/usuarios', usuariosRouter)
app.use('/api', paquetesRouter)
// Todo lo demás es solo para el equipo (Super Admin); el Usuario solo ve paquetes y sus pedidos
app.use('/api', requireAuth, requireRol('super_admin'))
app.use('/api', catalogosRouter)
app.use('/api', solicitudesRouter)
app.use('/api', encargosRouter)
app.use('/api', panelRouter)
app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }))

// Producción: si existe el build del frontend (frontend/dist) lo sirve el mismo backend
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

app.use(errorHandler)
app.listen(env.port, () => console.log(`🎤 API del Gestor de Eventos 6 en http://localhost:${env.port}`))
