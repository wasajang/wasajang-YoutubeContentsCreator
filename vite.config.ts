import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  // Fish Speech API 대상: 자체 서버 URL 또는 클라우드
  const fishTarget = env.VITE_FISH_SPEECH_API_URL || 'https://api.fish.audio'

  return {
    plugins: [react()],
    server: {
      proxy: {
        // Fish Speech API — CORS 우회 프록시
        // 자체 서버: http://localhost:8080 으로 전달
        // 클라우드:  https://api.fish.audio 로 전달
        '/api/fish-speech': {
          target: fishTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/fish-speech/, ''),
        },
      },
    },
  }
})
