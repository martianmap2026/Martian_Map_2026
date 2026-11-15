import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Depuración en consola para verificar que las llaves no estén vacías
console.log("URL cargada:", supabaseUrl ? "Sí (" + supabaseUrl.substring(0, 15) + "...)" : "NO DEFINIDA")
console.log("ANON_KEY cargada:", supabaseAnonKey ? "Sí (Longitud: " + supabaseAnonKey.length + ")" : "NO DEFINIDA")

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("⚠️ Faltan las variables de entorno de Supabase en el archivo .env de frontend/")
}

export const supabase = createClient(
  supabaseUrl || '', 
  supabaseAnonKey || ''
)