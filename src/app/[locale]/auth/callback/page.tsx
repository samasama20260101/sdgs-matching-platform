'use client'

// メールのリンクと Google から戻る先。セッションの受け取りは supabase-js が URL から行う(detectSessionInUrl)。
// 受け取れたら /start に送り(ログインの前にいた画面を next で渡す)、はじめの質問がまだならそこで聞く
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from '@/i18n/navigation'
import { loginPathFor, safeNext } from '@/lib/domain/safeNext'
import { Button, Lead, Screen, Spinner } from '@/components/app/ui'

export default function AuthCallbackPage() {
  const router = useRouter()
  const t = useTranslations('app.start')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let done = false
    // ログインの前にいた画面(/start が ?next= で渡したもの)へ、/start を通して戻る
    const back = loginPathFor(safeNext(new URLSearchParams(window.location.search).get('next')))
    const go = () => {
      if (done) return
      done = true
      router.replace(back)
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) go()
    })
    void supabase.auth.getSession().then(({ data }) => { if (data.session) go() })
    const timer = window.setTimeout(() => { if (!done) setFailed(true) }, 8000)
    return () => {
      sub.subscription.unsubscribe()
      window.clearTimeout(timer)
    }
  }, [router])

  return (
    <Screen>
      <div className="flex flex-col gap-3 pt-20">
        {failed ? (
          <>
            <Lead>{t('callbackFailed')}</Lead>
            <Button variant="night" onClick={() => router.replace('/start')}>{t('backToStart')}</Button>
          </>
        ) : (
          <Spinner />
        )}
      </div>
    </Screen>
  )
}
