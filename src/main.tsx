import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { supabase } from './integrations/supabase/client'
import App from './App.tsx'
import './index.css'

// Initialize Supabase session persistence
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    // Persist session across tabs
    localStorage.setItem('supabase.auth.token', session?.access_token || '')
  }
  if (event === 'SIGNED_OUT') {
    localStorage.removeItem('supabase.auth.token')
  }
})

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)