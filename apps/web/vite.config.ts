import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'

const config = defineConfig(({ mode }) => {
  const rootEnvironment = loadEnv(mode, '../..', '')

  for (const [name, value] of Object.entries(rootEnvironment)) {
    process.env[name] ??= value
  }

  return {
    envDir: '../..',
    resolve: { tsconfigPaths: true },
    plugins: [tailwindcss(), tanstackStart(), viteReact()],
  }
})

export default config
