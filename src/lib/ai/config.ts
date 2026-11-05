// AI の提供元とモデルを用途ごとに決める(純粋関数。環境変数を引数で受ける)。
//
// 提供元: `AI_<用途>_PROVIDER` → `AI_PROVIDER` → 鍵がある提供元(gemini → openai → xai の順)。
//   翻訳だけは 11/5 の定例で「まず Grok で試す」と決めたので、xAI の鍵があれば xAI を先に選ぶ。
// モデル: `AI_<用途>_MODEL`(用途の提供元を指定したときだけ)→ `AI_<提供元>_MODEL`(例 AI_OPENAI_MODEL)。
//   推測で既定値を置かない(Gemini だけ今の本番と同じ値を既定にする)。決まらなければ null を返し、
//   呼び出し側は AI を使わない動き(デモの結果・下書きなし)に落とす。
export type AiProvider = 'gemini' | 'openai' | 'xai'
export type AiTask = 'consultation' | 'news' | 'translation'

export type AiTarget = {
  provider: AiProvider
  model: string
  apiKey: string
  baseUrl: string
}

type Env = Record<string, string | undefined>

const PROVIDERS: readonly AiProvider[] = ['gemini', 'openai', 'xai']
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'
const BASE_URLS: Record<AiProvider, string> = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  openai: 'https://api.openai.com/v1',
  xai: 'https://api.x.ai/v1',
}

function clean(value: string | undefined): string {
  return (value ?? '').trim()
}

export function apiKeyFor(provider: AiProvider, env: Env): string {
  switch (provider) {
    case 'gemini':
      return clean(env.GOOGLE_GEMINI_API_KEY) || clean(env.GEMINI_API_KEY)
    case 'openai':
      return clean(env.OPENAI_API_KEY)
    case 'xai':
      return clean(env.XAI_API_KEY)
  }
}

function parseProvider(value: string | undefined): AiProvider | null {
  const v = clean(value).toLowerCase()
  return (PROVIDERS as readonly string[]).includes(v) ? (v as AiProvider) : null
}

export function resolveAiTarget(task: AiTask, env: Env): AiTarget | null {
  const prefix = `AI_${task.toUpperCase()}_`
  const explicit = parseProvider(env[`${prefix}PROVIDER`]) ?? parseProvider(env.AI_PROVIDER)
  const order: AiProvider[] = task === 'translation' ? ['xai', 'gemini', 'openai'] : ['gemini', 'openai', 'xai']
  const provider = explicit ?? order.find((p) => apiKeyFor(p, env)) ?? null
  if (!provider) return null

  const apiKey = apiKeyFor(provider, env)
  if (!apiKey) return null

  const taskProviderExplicit = parseProvider(env[`${prefix}PROVIDER`]) !== null
  const taskModel = taskProviderExplicit ? clean(env[`${prefix}MODEL`]) : ''
  const providerModel = clean(env[`AI_${provider.toUpperCase()}_MODEL`])
  const model = taskModel || providerModel || (provider === 'gemini' ? DEFAULT_GEMINI_MODEL : '')
  if (!model) return null

  const baseUrl = clean(env[`AI_${provider.toUpperCase()}_BASE_URL`]) || BASE_URLS[provider]
  return { provider, model, apiKey, baseUrl: baseUrl.replace(/\/+$/, '') }
}
