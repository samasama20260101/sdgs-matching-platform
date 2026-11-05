'use client'

// 画面を開いたとき(と読む条件が変わったとき)に API から読み、操作のあとは reload で読み直す。
//   - 条件を切り替えた直後に、前の条件の応答が遅れて届いても上書きしない(最後に頼んだものだけを使う)
//   - 読めなかったときは error に入れる。前に読めたデータは消さない
//   - reload は失敗しても投げない(結果は data と error に出る)
// fetcher は useCallback で包んで渡す。fetcher が変わったときだけ読み直す
import { useCallback, useEffect, useRef, useState } from 'react'

type Loaded<T> = { data: T | null; error: unknown }

export function useLoad<T>(fetcher: () => Promise<T>) {
  const [state, setState] = useState<Loaded<T>>({ data: null, error: null })
  const latest = useRef(0)

  // 結果は then の中でだけ受け取る(副作用の中で同期的に状態を変えない)
  const track = useCallback((pending: Promise<T>) => {
    const ticket = ++latest.current
    return pending.then(
      (data) => {
        if (ticket === latest.current) setState({ data, error: null })
      },
      (error: unknown) => {
        if (ticket === latest.current) setState((prev) => ({ data: prev.data, error }))
      },
    )
  }, [])

  useEffect(() => {
    void track(fetcher())
  }, [fetcher, track])

  const reload = useCallback(() => track(fetcher()), [fetcher, track])

  return { data: state.data, error: state.error, reload }
}
