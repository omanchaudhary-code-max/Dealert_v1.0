import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { env } from '@/lib/env'
import { authConfig } from '@/config/auth.config'

export interface TokenPayload extends JWTPayload {
  userId: string
  role: string
  email: string
}

// Lazy getters — evaluated at request time, not build time
function getAccessSecret() {
  return new TextEncoder().encode(env.JWT_ACCESS_SECRET)
}
function getRefreshSecret() {
  return new TextEncoder().encode(env.JWT_REFRESH_SECRET)
}

export async function signAccessToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(authConfig.jwt.accessExpiresIn)
    .sign(getAccessSecret())
}

export async function signRefreshToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(authConfig.jwt.refreshExpiresIn)
    .sign(getRefreshSecret())
}

export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getAccessSecret())
  return payload as TokenPayload
}

export async function verifyRefreshToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getRefreshSecret())
  return payload as TokenPayload
}