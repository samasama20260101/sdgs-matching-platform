// どの環境で動いているか。Cloudflare Workers では wrangler.jsonc の vars `APP_ENV`、
// Vercel では `VERCEL_ENV` を見る(載せ替えのあいだは両方で動くため)。
export type DeployEnv = 'production' | 'staging' | 'development'

export function resolveDeployEnv(env: { APP_ENV?: string; VERCEL_ENV?: string; NODE_ENV?: string }): DeployEnv {
  const appEnv = env.APP_ENV?.trim()
  if (appEnv === 'production' || appEnv === 'staging') return appEnv
  if (env.VERCEL_ENV === 'production') return 'production'
  if (env.VERCEL_ENV === 'preview') return 'staging'
  return 'development'
}

export function getDeployEnv(): DeployEnv {
  return resolveDeployEnv(process.env)
}

export function isProductionDeployment(): boolean {
  return getDeployEnv() === 'production'
}
