import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { IconContext } from '@phosphor-icons/react'
import App from './App'
import { ToastProvider } from './components/Toast'
import { rootClient } from './lib/queryClient'
import './styles/index.css'


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={rootClient}>
      {/* Phosphor duotone everywhere (README "Visual system"). */}
      <IconContext.Provider value={{ weight: 'duotone', size: '1em', color: 'currentColor', mirrored: false }}>
        <BrowserRouter>
          <ToastProvider>
            <App />
          </ToastProvider>
        </BrowserRouter>
      </IconContext.Provider>
    </QueryClientProvider>
  </StrictMode>
)
