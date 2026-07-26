import express from 'express'
import { r2PublicUrl } from '../config/r2.js'

const router = express.Router()

router.get('/config', (_req, res) => {
  if (!r2PublicUrl) {
    return res.status(503).json({ error: 'R2_PUBLIC_URL is not configured.' })
  }

  return res.json({ publicUrl: r2PublicUrl })
})

export default router
