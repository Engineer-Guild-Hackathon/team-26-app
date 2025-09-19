import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import StudySettings from './pages/StudySettings'
import Study from './pages/Study'
import Break from './pages/Break'
import Materials from './pages/Materials'
import { useSecurityRestrictions } from './hooks/useSecurityRestrictions'
import './App.css'

function AppContent() {
  // セキュリティ制限を適用
  useSecurityRestrictions();
  
  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/study-settings" element={<StudySettings />} />
        <Route path="/study" element={<Study />} />
        <Route path="/break" element={<Break />} />
        <Route path="/materials" element={<Materials />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

export default App
