import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthContext'
import { useAuth } from '@/auth/useAuth'
import { ToastProvider, Skeleton } from '@/components/ui'
import { AppShell } from '@/components/layout/AppShell'
import { RequirePermission } from '@/components/layout/Guard'
import type { Permission } from '@/auth/permissions'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'

const Studies = lazy(() => import('@/pages/Studies'))
const StudyWorkspace = lazy(() => import('@/pages/StudyWorkspace'))
const Sites = lazy(() => import('@/pages/Sites'))
const Participants = lazy(() => import('@/pages/Participants'))
const ParticipantProfile = lazy(() => import('@/pages/ParticipantProfile'))
const Visits = lazy(() => import('@/pages/Visits'))
const Ecrf = lazy(() => import('@/pages/Ecrf'))
const Ethics = lazy(() => import('@/pages/Ethics'))
const Safety = lazy(() => import('@/pages/Safety'))
const Documents = lazy(() => import('@/pages/Documents'))
const Analytics = lazy(() => import('@/pages/Analytics'))
const DataStandards = lazy(() => import('@/pages/DataStandards'))
const Audit = lazy(() => import('@/pages/Audit'))
const Settings = lazy(() => import('@/pages/Settings'))

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const loc = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />
  return <>{children}</>
}

function PageFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-4 w-96" />
      <Skeleton className="mt-6 h-[420px] w-full" />
    </div>
  )
}

const guarded = (perm: Permission, el: ReactNode) => (
  <RequirePermission perm={perm}>
    <Suspense fallback={<PageFallback />}>{el}</Suspense>
  </RequirePermission>
)

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<RequireAuth><AppShell /></RequireAuth>}>
              <Route index element={<Dashboard />} />
              <Route path="studies" element={guarded('studies:view', <Studies />)} />
              <Route path="studies/:id" element={guarded('studies:view', <StudyWorkspace />)} />
              <Route path="participants" element={guarded('participants:view', <Participants />)} />
              <Route path="participants/:id" element={guarded('participants:view', <ParticipantProfile />)} />
              <Route path="sites" element={guarded('sites:view', <Sites />)} />
              <Route path="visits" element={guarded('visits:view', <Visits />)} />
              <Route path="ecrf" element={guarded('ecrf:view', <Ecrf />)} />
              <Route path="ethics" element={guarded('ethics:view', <Ethics />)} />
              <Route path="safety" element={guarded('safety:view', <Safety />)} />
              <Route path="documents" element={guarded('documents:view', <Documents />)} />
              <Route path="analytics" element={guarded('analytics:view', <Analytics />)} />
              <Route path="standards" element={guarded('standards:view', <DataStandards />)} />
              <Route path="audit" element={guarded('audit:view', <Audit />)} />
              <Route path="settings" element={guarded('settings:view', <Settings />)} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
