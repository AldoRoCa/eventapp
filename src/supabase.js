import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jvjngaxpqdeababfxecp.supabase.co'
const supabaseKey = 'sb_publishable_uglG9QxSBBwVAWMyFCyxiw_IheVeC0l'

export const supabase = createClient(supabaseUrl, supabaseKey)