import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base relativa: funciona en GitHub Pages (/<repo>/) y en cualquier carpeta del servidor
export default defineConfig({ base: './', plugins: [react()] })
