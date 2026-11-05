'use client'

// ブラウザから API を呼ぶ唯一の入口。ログイン中なら Bearer を付ける(DB はブラウザから直接読まない。operations.md §7)
import { supabase } from '@/lib/supabase/client'

export class ApiError extends Error {
  constructor(public status: number, public code: string | undefined, message: string) {
    super(message)
  }
}

export async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export async function apiFetch<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const token = await accessToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  let body = init.body
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(init.json)
  }
  const response = await fetch(path, { ...init, headers, body })
  const text = await response.text()
  const data = text ? (JSON.parse(text) as unknown) : null
  if (!response.ok) {
    const err = (data ?? {}) as { error?: string; code?: string }
    throw new ApiError(response.status, err.code, err.error ?? `HTTP ${response.status}`)
  }
  return data as T
}
