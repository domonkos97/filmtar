import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource/bebas-neue'
import '@fontsource/playfair-display/700.css'
import '@fontsource/cinzel/600.css'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/special-elite'
import '@fontsource/fredoka/600.css'
import '@fontsource/space-grotesk/700.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
