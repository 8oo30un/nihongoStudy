import type { IncomingMessage, ServerResponse } from 'node:http'
import { handle } from '@hono/node-server/vercel'
import { createApp } from '../server/app.js'

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
}

const listener = handle(createApp())

function restoreOriginalApiPath(req: IncomingMessage) {
  const url = new URL(req.url || '/', 'http://local')
  const path = url.searchParams.get('__path')
  if (!path) return
  url.searchParams.delete('__path')
  const search = url.searchParams.toString()
  req.url = `/api/${path}${search ? `?${search}` : ''}`
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  restoreOriginalApiPath(req)
  return listener(req, res)
}
