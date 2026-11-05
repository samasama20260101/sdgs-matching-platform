// /api/me が返す形(サーバーとブラウザの両方で使う)
export type MeOrganizationFace = {
  organizationId: string
  organizationName: string
  orgType: string
  vettingStatus: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
  isCoordinator: boolean
}

export type MePerson = {
  id: string
  displayId: string | null
  role: 'PERSON' | 'ADMIN'
  displayName: string
  age: number | null
  isMinor: boolean
  country: string
  regionCode: string | null
  city: string | null
  locale: string
}

export type MeResponse =
  | { onboarded: false; email: string | null }
  | {
      onboarded: true
      email: string | null
      person: MePerson
      consentsUpToDate: boolean
      faces: { organizations: MeOrganizationFace[]; individual: { realName: string; phoneVerified: boolean; status: 'ACTIVE' | 'SUSPENDED' } | null }
      mfa: { enrolled: boolean; verified: boolean }
      loginMethods: string[]
    }
