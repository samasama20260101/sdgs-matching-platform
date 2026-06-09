import 'server-only'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function normalizeUuid(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return UUID_PATTERN.test(trimmed) ? trimmed : null
}

export function isUuid(value: unknown): value is string {
  return normalizeUuid(value) !== null
}

export function normalizeUuidList(values: unknown[]) {
  const normalized = values.map(normalizeUuid)
  if (normalized.some((value) => value === null)) return null
  return [...new Set(normalized as string[])]
}
