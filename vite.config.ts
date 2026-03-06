import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Edge TTS Vite 미들웨어 플러그인
 * POST /api/edge-tts 요청을 서버사이드에서 처리 (브라우저 WebSocket 제한 우회)
 * 개발 서버에서만 동작
 */
function edgeTTSPlugin(): Plugin {
  return {
    name: 'edge-tts-middleware',
    configureServer(server) {
      server.middlewares.use('/api/edge-tts', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'POST only' }))
          return
        }

        // POST body 읽기
        let body = ''
        for await (const chunk of req) {
          body += chunk
        }

        try {
          const { text, voice, speed } = JSON.parse(body) as {
            text?: string
            voice?: string
            speed?: number
          }

          if (!text) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'text is required' }))
            return
          }

          // edge-tts 패키지 동적 import (Node.js 전용)
          const { tts: edgeTts } = await import('edge-tts')

          // SSML rate 변환 (speed 1.0 = +0%, 1.5 = +50%, 0.5 = -50%)
          const rate = speed && speed !== 1.0
            ? `${speed > 1 ? '+' : ''}${Math.round((speed - 1) * 100)}%`
            : '+0%'

          // tts() 함수는 Buffer를 반환 (MP3)
          const audioBuffer = await edgeTts(text, {
            voice: voice || 'ko-KR-SunHiNeural',
            rate,
          })

          // MP3 바이너리 응답
          res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioBuffer.length.toString(),
            'Cache-Control': 'no-cache',
          })
          res.end(audioBuffer)
        } catch (err) {
          console.error('[Edge TTS] Error:', err)
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
          }
          res.end(JSON.stringify({ error: (err as Error).message }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  // Fish Speech API 대상: 자체 서버 URL 또는 클라우드
  const fishTarget = env.VITE_FISH_SPEECH_API_URL || 'https://api.fish.audio'

  return {
    plugins: [
      react(),
      edgeTTSPlugin(),
    ],
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
