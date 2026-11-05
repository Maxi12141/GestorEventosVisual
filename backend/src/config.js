import 'dotenv/config'

export const env = {
  url: process.env.SUPABASE_URL,
  serviceKey: process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY, // SUPABASE_KEY = compatibilidad con versiones anteriores
  anonKey: process.env.SUPABASE_ANON_KEY || '',
  port: Number(process.env.PORT) || 3001,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  permitirRegistro: String(process.env.PERMITIR_REGISTRO ?? 'true').toLowerCase() !== 'false',
  adminEmail: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
}

if (!env.url || !env.serviceKey) {
  console.error('\n❌ Faltan SUPABASE_URL y/o SUPABASE_SERVICE_KEY en backend/.env (copiá .env.example a .env)\n')
  process.exit(1)
}
