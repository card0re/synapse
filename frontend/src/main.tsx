import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
// @ts-ignore
import './index.css'
import { GoogleOAuthProvider } from '@react-oauth/google'

const GOOGLE_CLIENT_ID = "286568370439-7nvc2p5mbfsr97joicuoois5uq8gvr5g.apps.googleusercontent.com"

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