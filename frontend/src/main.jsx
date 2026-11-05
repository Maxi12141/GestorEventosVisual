import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, theme as antTheme } from 'antd'
import esES from 'antd/locale/es_ES'
import App from './App.jsx'
import { AuthProvider } from './auth.jsx'
import { ToastProvider } from './ui.jsx'
import './styles.css'
import './polish.css'

// Tema oscuro futurista: cian eléctrico + violeta sobre fondo noche
const tema = {
  algorithm: antTheme.darkAlgorithm,
  token: {
    colorPrimary: '#5cefff', colorInfo: '#5cefff', colorSuccess: '#3ee0a8', colorWarning: '#ffb547', colorError: '#ff5c7a',
    colorBgBase: '#070814', colorBgContainer: '#10142e', colorBgElevated: '#161b3d', colorBorder: '#2a3368', colorBorderSecondary: '#1d2454',
    colorTextBase: '#f2f4ff', borderRadius: 14, fontFamily: "'Outfit', system-ui, -apple-system, 'Segoe UI', sans-serif", fontSize: 15,
    controlHeight: 40, wireframe: false,
  },
  components: {
    Button: { primaryColor: '#04101f', fontWeight: 600, controlHeight: 40 },
    Modal: { contentBg: '#121735', headerBg: '#121735' },
    Table: { headerBg: 'transparent', rowHoverBg: 'rgba(92,239,255,.06)' },
    Segmented: { itemSelectedBg: '#1a2155' },
  },
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider theme={tema} locale={esES}>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </ConfigProvider>
  </React.StrictMode>
)
