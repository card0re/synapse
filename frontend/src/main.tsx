import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
// @ts-ignore
import './index.css'
import { GoogleOAuthProvider } from '@react-oauth/google'

const GOOGLE_CLIENT_ID = "286568370439-7nvc2p5mbfsr97joicuoois5uq8gvr5g.apps.googleusercontent.com"

// Google Analytics 4. Вантажиться тільки якщо задано VITE_GA_ID — без нього
// код нічого не робить. SPA-переходи GA4 ловить сам (Enhanced measurement:
// "Page changes based on browser history events" увімкнено за замовчуванням).
const GA_ID = import.meta.env.VITE_GA_ID
if (GA_ID) {
    const s = document.createElement('script')
    s.async = true
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
    document.head.appendChild(s)
    const w = window as any
    w.dataLayer = w.dataLayer || []
    w.gtag = function () { w.dataLayer.push(arguments) }
    w.gtag('js', new Date())
    w.gtag('config', GA_ID)
}

const rootElement = document.getElementById('root')

if (rootElement) {
    createRoot(rootElement).render(
        <React.StrictMode>
            <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                <App />
            </GoogleOAuthProvider>
        </React.StrictMode>
    )
}