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
import { websiteBase } from './lib/website-mount.ts'
import { gameRuntime } from './lib/game-runtime.ts'
import { migrateParallelGuestSave } from './lib/parallel-save-migration.ts'
import Shell from './components/Shell'
import Home from './pages/Home'
import SearchParties from './pages/SearchParties'
import Mods from './pages/Mods'
import ModDetail from './pages/ModDetail'
import ModVersions from './pages/ModVersions'
import ModUpload from './pages/ModUpload'
import Login from './pages/Login'
import Register from './pages/Register'
import Account from './pages/Account'
import About from './pages/About'
import Downloads from './pages/Downloads'
import Wizard from './pages/Wizard'
import NotFound from './pages/NotFound'
import RouteError from './pages/RouteError'
import { Spinner } from './components/ui'

const Game = gameRuntime === 'rust'
  ? lazy(() => import('./pages/RustGame'))
  : lazy(async () => {
    await migrateParallelGuestSave()
    return import('./pages/Game')
  })

const router = createBrowserRouter([
  {
    path: '/boneyard-library',
    errorElement: <RouteError />,
    lazy: async () => {
      const { default: Component } = await import('./pages/BoneyardLibrary.tsx')
      return { Component }
    },
  },
  {
    path: '/boneyards',
    errorElement: <RouteError />,
    lazy: async () => {
      const { default: Component } = await import('./pages/BoneyardViewer')
      return { Component }
    },
  },
  {
    element: <Shell />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <Home /> },
      {
        path: '/boneyard',
        // The loader consumes the one-use shelf request before React mounts.
        lazy: async () => {
          const [{ default: Component }, { loadWorkshopRequest: loader }] = await Promise.all([
            import('./pages/BoneyardWorkshopRoute.tsx'),
            import('./editor/workshop-navigation.ts'),
          ])
          return { Component, loader }
        },
      },
      {
        path: '/game',
        element: (
          <Suspense fallback={<Spinner label="Opening Solomon Dark…" />}>
            <Game />
          </Suspense>
        ),
      },
      { path: '/parties', element: <SearchParties /> },
      { path: '/mods', element: <Mods /> },
      { path: '/mods/upload', element: <ModUpload /> },
      { path: '/mods/:slug', element: <ModDetail /> },
      { path: '/mods/:slug/versions', element: <ModVersions /> },
      { path: '/login', element: <Login /> },
      { path: '/register', element: <Register /> },
      { path: '/account', element: <Account /> },
      { path: '/about', element: <About /> },
      { path: '/downloads', element: <Downloads /> },
      { path: '/wizards/:username', element: <Wizard /> },
      { path: '*', element: <NotFound /> },
    ],
  },
], { basename: websiteBase || '/' })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
)
