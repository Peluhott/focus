import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { IconContext } from '@phosphor-icons/react'
import App from './App'
import { ToastProvider } from './components/Toast'
import './styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
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
