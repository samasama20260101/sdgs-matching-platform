'use client'

// 端末に覚える小さな値(localStorage)を画面から読み書きする。
//   - useSyncExternalStore で読むので、サーバーの描画と水和の最初の描画は null、そのあと端末の値に替わる(水和のずれを出さない)
//   - 書けない端末(容量・設定)でも、開いているあいだはメモリに覚えて切り替わる
//   - 別のタブでの書き換えは追わない(開いたときの値と、このタブで選んだ値だけを使う)
import { useCallback, useSyncExternalStore } from 'react'

const cache = new Map<string, string | null>()
const listeners = new Set<() => void>()

function read(key: string): string | null {
  if (!cache.has(key)) {
    let value: string | null = null
    try {
      value = window.localStorage.getItem(key)
    } catch {
      value = null
    }
    cache.set(key, value)
  }
  return cache.get(key) ?? null
}

function write(key: string, value: string) {
  cache.set(key, value)
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // 覚えられなくても、開いているあいだはメモリの値で切り替わる
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const serverSnapshot = () => null

export function useStoredValue(key: string): [string | null, (value: string) => void] {
  const value = useSyncExternalStore(subscribe, () => read(key), serverSnapshot)
  const set = useCallback((next: string) => write(key, next), [key])
  return [value, set]
}
