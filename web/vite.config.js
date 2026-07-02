/*
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.BASE || '/',
  server: {
    port: Number(process.env.PORT) || 3000,
    strictPort: true
  }
});*/

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    base: env.BASE || "/",
    server: {
      port: Number(env.PORT) || 3000,
      strictPort: true,
    },
  };
});