import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { TestApp } from './routes/TestApp'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/personality-test" element={<TestApp />} />
        <Route path="*" element={<Navigate to="/personality-test" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
