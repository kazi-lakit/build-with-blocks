import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const httpsConfig =
    env.SSL_KEY_PATH && env.SSL_CERT_PATH
      ? {
          key: readFileSync(env.SSL_KEY_PATH),
          cert: readFileSync(env.SSL_CERT_PATH),
        }
      : undefined

  return {
    plugins: [react()],
    server: {
      port: parseInt(env.PORT || '5173'),
      https: httpsConfig,
    },
  }
})
