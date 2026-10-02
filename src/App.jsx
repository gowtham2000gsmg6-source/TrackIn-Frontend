import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import CheckIn from './pages/CheckIn.jsx'
import Active from './pages/Active.jsx'
import History from './pages/History.jsx'
import MapPage from './pages/Map.jsx'
import VisitorCheckIn from './pages/VisitorCheckIn.jsx'
import ReceiverLogin from './pages/ReceiverLogin.jsx'
import ReceiverDashboard, { ReceiverGuard } from './pages/ReceiverDashboard.jsx'
import Receivers from './pages/Receivers.jsx'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

export default function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#0D1521', color: '#FBF7EF', border: '1px solid rgba(255,255,255,0.1)' },
        }}
      />
      <Routes>
        {/* Public, login-free — reached by scanning the gate QR code / link. */}
        <Route path="/visit" element={<VisitorCheckIn />} />
        <Route path="/receiver" element={<ReceiverLogin />} />
        <Route path="/receiver/dashboard" element={<ReceiverGuard><ReceiverDashboard /></ReceiverGuard>} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/check-in" element={<CheckIn />} />
                  <Route path="/active" element={<Active />} />
                  <Route path="/map" element={<MapPage />} />
                  <Route path="/receivers" element={<Receivers />} />
                  <Route path="/history" element={<History />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  )
}
