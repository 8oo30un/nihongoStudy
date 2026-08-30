import type { Plugin } from 'vite'
import { getRequestListener } from '@hono/node-server'
import { createApp } from './app.js'
import { ensureReady } from './db.js'

export function sqliteApiPlugin(): Plugin {
  const app = createApp()
  const listener = getRequestListener(app.fetch)
  const handle = (req: Parameters<typeof listener>[0], res: Parameters<typeof listener>[1], next: () => void) => {
    if (!req.url?.startsWith('/api')) {
      next()
      return
    }
    listener(req, res)
  }
  return {
    name: 'sqlite-api',
    configureServer(server) {
      void ensureReady()
      server.middlewares.use(handle)
    },
    configurePreviewServer(server) {
      void ensureReady()
      server.middlewares.use(handle)
    },
  }
}
