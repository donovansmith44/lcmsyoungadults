import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { TestApp } from './routes/TestApp'
import { AdminPage } from './routes/admin/AdminPage'
import { UnderConstruction } from './routes/UnderConstruction'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UnderConstruction />} />
        <Route path="/personality-test" element={<TestApp />} />
        <Route path="/personality" element={<Navigate to="/personality-test" replace />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
