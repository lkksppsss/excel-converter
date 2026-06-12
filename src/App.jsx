import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import HomePage from './pages/HomePage'
import GenericTemplateFillPage from './pages/GenericTemplateFillPage'
import TemplateFillPage from './pages/TemplateFillPage'
import './App.css'

// 舊版薪資清冊填入：首頁已改連到新版通用範本填入，路由暫時保留（規格書 §五）
function LegacyTemplateFillRoute() {
  const navigate = useNavigate()
  return <TemplateFillPage onBack={() => navigate('/')} />
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="template-fill" element={<GenericTemplateFillPage />} />
          <Route path="template-fill/:step" element={<GenericTemplateFillPage />} />
          <Route path="legacy-template-fill" element={<LegacyTemplateFillRoute />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
