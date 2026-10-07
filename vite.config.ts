import { defineConfig } from 'vite';
export default defineConfig({base: process.env.BASE_PATH || './', build:{outDir:'dist', sourcemap:false}, server:{host:'0.0.0.0',allowedHosts:['terminal.local']}, preview:{host:'0.0.0.0'}});
