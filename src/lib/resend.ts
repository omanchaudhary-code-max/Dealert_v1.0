import { Resend } from 'resend'
import { env } from '@/lib/env'

export function getResend() {
  return new Resend(env.RESEND_API_KEY)
}

export const FROM_EMAIL = env.RESEND_FROM_EMAIL