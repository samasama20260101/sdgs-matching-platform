'use client'

// 文字の大きさを端末に覚え、<html> の属性に反映する
import { useCallback } from 'react'
import { useStoredValue } from '@/lib/client/storedValue'
import { TEXT_SIZE_ATTR, TEXT_SIZE_KEY, parseTextSize, textSizeAttr, type TextSize } from '@/lib/domain/textSize'

export function applyTextSize(size: TextSize) {
  const value = textSizeAttr(size)
  if (value) document.documentElement.setAttribute(TEXT_SIZE_ATTR, value)
  else document.documentElement.removeAttribute(TEXT_SIZE_ATTR)
}

// 開いたときの属性は layout の <head> のスクリプトが付ける。ここで選び直したときは、その場で属性を替える
export function useTextSize(): [TextSize, (size: TextSize) => void] {
  const [stored, store] = useStoredValue(TEXT_SIZE_KEY)
  const choose = useCallback((size: TextSize) => {
    store(size)
    applyTextSize(size)
  }, [store])
  return [parseTextSize(stored), choose]
}
