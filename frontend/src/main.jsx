import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { NotificationProvider } from './NotificationContext.jsx'

// Anti-Clickjacking Framebuster: Mencegah web di-iframe oleh malware/hacker
if (typeof window !== 'undefined' && window.top !== window.self) {
  try {
    window.top.location = window.self.location;
  } catch {
    // blocked by cross-origin
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <NotificationProvider>
      <App />
    </NotificationProvider>
  </React.StrictMode>,
)