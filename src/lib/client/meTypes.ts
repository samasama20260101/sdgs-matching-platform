// /api/me が返す形(サーバーとブラウザの両方で使う)
export type MeOrganizationFace = {
  organizationId: string
  organizationName: string
  orgType: string
  vettingStatus: string
  role: 'OWNER' | 'MEMBER'
  isCoordinator: boolean
  // 支え手の団体か(#131)。相談のための団体は支える側の顔にしない
  supporter: boolean
  // この団体で支え手の申し込みができるか(相談のための団体の管理の人)
  canApplySupporter: boolean
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
  // 市区町村の団体コードと名前(#173)
  municipalityCode: string | null
  municipalityName: string | null
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
