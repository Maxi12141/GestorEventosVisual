import { createClient } from '@supabase/supabase-js'
import { env } from './config.js'

const opts = { auth: { persistSession: false, autoRefreshToken: false } }

// Cliente con la clave secreta: se salta el RLS. NUNCA se expone al navegador.
export const supabase = createClient(env.url, env.serviceKey, opts)

// Cliente "limpio" para operaciones de login (uno por request, no comparte sesión)
export const authClient = () => createClient(env.url, env.anonKey || env.serviceKey, opts)
