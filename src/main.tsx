import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Import MathLive to register the web component
import 'mathlive'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
