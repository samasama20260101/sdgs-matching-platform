// scripts/create-test-users.ts
// 使い方: npx ts-node scripts/create-test-users.ts
// または: npx tsx scripts/create-test-users.ts

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const PASSWORD = 'testpass123'

const sosUsers = [
  { name: '大谷翔平',   email: 'sos01@gmail.com', gender: 'MALE',   birth: '1994-07-05', phone: '09011110001' },
  { name: '石川佳純',   email: 'sos02@gmail.com', gender: 'FEMALE', birth: '1993-02-23', phone: '09011110002' },
  { name: '羽生結弦',   email: 'sos03@gmail.com', gender: 'MALE',   birth: '1994-12-07', phone: '09011110003' },
  { name: '伊藤美誠',   email: 'sos04@gmail.com', gender: 'FEMALE', birth: '2000-10-21', phone: '09011110004' },
  { name: '堀米雄斗',   email: 'sos05@gmail.com', gender: 'MALE',   birth: '1999-01-07', phone: '09011110005' },
  { name: '高木美帆',   email: 'sos06@gmail.com', gender: 'FEMALE', birth: '1994-05-22', phone: '09011110006' },
  { name: '池江璃花子', email: 'sos07@gmail.com', gender: 'FEMALE', birth: '2000-07-04', phone: '09011110007' },
  { name: '桐生祥秀',   email: 'sos08@gmail.com', gender: 'MALE',   birth: '1995-12-15', phone: '09011110008' },
  { name: '内村航平',   email: 'sos09@gmail.com', gender: 'MALE',   birth: '1989-01-03', phone: '09011110009' },
  { name: '吉田沙保里', email: 'sos10@gmail.com', gender: 'FEMALE', birth: '1982-10-05', phone: '09011110010' },
  { name: '錦織圭',     email: 'sos11@gmail.com', gender: 'MALE',   birth: '1989-12-29', phone: '09011110011' },
  { name: '宮里藍',     email: 'sos12@gmail.com', gender: 'FEMALE', birth: '1985-06-19', phone: '09011110012' },
  { name: '北島康介',   email: 'sos13@gmail.com', gender: 'MALE',   birth: '1983-09-16', phone: '09011110013' },
  { name: '野村忠宏',   email: 'sos14@gmail.com', gender: 'MALE',   birth: '1974-01-10', phone: '09011110014' },
  { name: '谷亮子',     email: 'sos15@gmail.com', gender: 'FEMALE', birth: '1975-05-06', phone: '09011110015' },
  { name: '室伏広治',   email: 'sos16@gmail.com', gender: 'MALE',   birth: '1978-10-08', phone: '09011110016' },
  { name: '浅田真央',   email: 'sos17@gmail.com', gender: 'FEMALE', birth: '1990-09-25', phone: '09011110017' },
  { name: '中田英寿',   email: 'sos18@gmail.com', gender: 'MALE',   birth: '1977-01-22', phone: '09011110018' },
  { name: '清水宏保',   email: 'sos19@gmail.com', gender: 'MALE',   birth: '1974-07-18', phone: '09011110019' },
  { name: '荻原次晴',   email: 'sos20@gmail.com', gender: 'MALE',   birth: '1971-10-05', phone: '09011110020' },
]

const supporters = [
  { org: '東京都',               name: '都庁担当者', email: 'gov01@gmail.com', type: 'GOVERNMENT', phone: '0311110001' },
  { org: '大阪府',               name: '府庁担当者', email: 'gov02@gmail.com', type: 'GOVERNMENT', phone: '0611110002' },
  { org: '愛知県',               name: '県庁担当者', email: 'gov03@gmail.com', type: 'GOVERNMENT', phone: '0521110003' },
  { org: '神奈川県',             name: '県庁担当者', email: 'gov04@gmail.com', type: 'GOVERNMENT', phone: '0451110004' },
  { org: '熊本県',               name: '県庁担当者', email: 'gov05@gmail.com', type: 'GOVERNMENT', phone: '0961110005' },
  { org: '織田信長NPO',          name: '織田信長',   email: 'npo01@gmail.com', type: 'NPO',        phone: '09022220001' },
  { org: '豊臣秀吉NPO',          name: '豊臣秀吉',   email: 'npo02@gmail.com', type: 'NPO',        phone: '09022220002' },
  { org: '徳川家康NPO',          name: '徳川家康',   email: 'npo03@gmail.com', type: 'NPO',        phone: '09022220003' },
  { org: '上杉謙信NPO',          name: '上杉謙信',   email: 'npo04@gmail.com', type: 'NPO',        phone: '09022220004' },
  { org: '武田信玄NPO',          name: '武田信玄',   email: 'npo05@gmail.com', type: 'NPO',        phone: '09022220005' },
  { org: 'ソフトバンク株式会社', name: '担当者A',    email: 'corp01@gmail.com', type: 'CORPORATE', phone: '0333330001' },
  { org: 'パナソニック株式会社', name: '担当者B',    email: 'corp02@gmail.com', type: 'CORPORATE', phone: '0333330002' },
  { org: 'トヨタ自動車株式会社', name: '担当者C',    email: 'corp03@gmail.com', type: 'CORPORATE', phone: '0333330003' },
  { org: '楽天グループ株式会社', name: '担当者D',    email: 'corp04@gmail.com', type: 'CORPORATE', phone: '0333330004' },
  { org: '株式会社リクルート',   name: '担当者E',    email: 'corp05@gmail.com', type: 'CORPORATE', phone: '0333330005' },
]

async function deleteExistingUsers() {
  console.log('既存テストユーザーを削除中...')
  const allEmails = [
    ...sosUsers.map(u => u.email),
    ...supporters.map(u => u.email),
  ]
  for (const email of allEmails) {
    const { data } = await supabaseAdmin.auth.admin.listUsers()
    const user = data.users.find(u => u.email === email)
    if (user) {
      await supabaseAdmin.auth.admin.deleteUser(user.id)
      console.log(`  削除: ${email}`)
    }
  }
}

async function createSosUsers() {
  console.log('\nSOSユーザーを作成中...')
  for (const u of sosUsers) {
    // 1. auth.usersに作成
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
    })
    if (authErr || !authData.user) {
      console.error(`  ❌ ${u.email}: ${authErr?.message}`)
      continue
    }

    // 2. public.usersに作成
    const { error: profileErr } = await supabaseAdmin.from('users').insert({
      auth_user_id: authData.user.id,
      role: 'SOS',
      real_name: u.name,
      display_name: u.name,
      email: u.email,
      gender: u.gender,
      birth_date: u.birth,
      phone: u.phone,
      region_country: 'JP',
      must_change_password: false,
    })
    if (profileErr) {
      console.error(`  ❌ public.users ${u.email}: ${profileErr.message}`)
    } else {
      console.log(`  ✅ ${u.email} (${u.name})`)
    }
  }
}

async function createSupporters() {
  console.log('\nサポーターを作成中...')
  for (const u of supporters) {
    // 1. auth.usersに作成
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
    })
    if (authErr || !authData.user) {
      console.error(`  ❌ ${u.email}: ${authErr?.message}`)
      continue
    }

    // 2. public.usersに作成
    const { error: profileErr } = await supabaseAdmin.from('users').insert({
      auth_user_id: authData.user.id,
      role: 'SUPPORTER',
      real_name: u.name,
      display_name: u.org,
      email: u.email,
      organization_name: u.org,
      supporter_type: u.type,
      phone: u.phone,
      region_country: 'JP',
      must_change_password: false,
    })
    if (profileErr) {
      console.error(`  ❌ public.users ${u.email}: ${profileErr.message}`)
    } else {
      console.log(`  ✅ ${u.email} (${u.org})`)
    }
  }
}

async function main() {
  console.log('=== テストユーザー作成スクリプト ===')
  console.log(`URL: ${SUPABASE_URL}`)
  console.log(`パスワード: ${PASSWORD}`)
  console.log('')

  await deleteExistingUsers()
  await createSosUsers()
  await createSupporters()

  console.log('\n=== 完了 ===')
}

main().catch(console.error)
