import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import '@fontsource/cinzel/500.css'
import '@fontsource/cinzel/700.css'
import '@fontsource/cinzel/800.css'
import '@fontsource/alegreya/400.css'
import '@fontsource/alegreya/500.css'
import '@fontsource/alegreya/700.css'
import '@fontsource/alegreya/400-italic.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import './index.css'

import { AuthProvider } from './lib/auth'
import Shell from './components/Shell'
import Home from './pages/Home'
import Classes from './pages/Classes'
import Mods from './pages/Mods'
import ModDetail from './pages/ModDetail'
import ModVersions from './pages/ModVersions'
import ModUpload from './pages/ModUpload'
import Login from './pages/Login'
import Register from './pages/Register'
import Account from './pages/Account'
import About from './pages/About'
import Wizard from './pages/Wizard'
import NotFound from './pages/NotFound'
import { Spinner } from './components/ui'

// The Boneyard editor carries its own atlas manifests and sprite pipeline;
// it loads when someone actually picks up the shovel.
const Boneyard = lazy(() => import('./pages/Boneyard'))

const router = createBrowserRouter([
  {
    path: '/boneyards',
    lazy: async () => {
      const { default: Component } = await import('./pages/BoneyardViewer')
      return { Component }
    },
  },
  {
    element: <Shell />,
    children: [
      { path: '/', element: <Home /> },
      {
        path: '/boneyard',
        element: (
          <Suspense fallback={<Spinner label="Surveying the grounds…" />}>
            <Boneyard />
          </Suspense>
        ),
      },
      { path: '/classes', element: <Classes /> },
      { path: '/mods', element: <Mods /> },
      { path: '/mods/upload', element: <ModUpload /> },
      { path: '/mods/:slug', element: <ModDetail /> },
      { path: '/mods/:slug/versions', element: <ModVersions /> },
      { path: '/login', element: <Login /> },
      { path: '/register', element: <Register /> },
      { path: '/account', element: <Account /> },
      { path: '/about', element: <About /> },
      { path: '/wizards/:username', element: <Wizard /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
)
