import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({ base: '/admin-panel-prot/', plugins: [react()] });
