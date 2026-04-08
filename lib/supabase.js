import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://rittvbydakkvcsoshpgg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpdHR2YnlkYWtrdmNzb3NocGdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDYzOTMsImV4cCI6MjA5MDgyMjM5M30.pGDouwiZJcqSXmBuVQJ1VT0OpRhDWA7Njs643rct7Do';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
