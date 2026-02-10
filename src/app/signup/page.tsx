'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/lib/supabase/client';

type UserRole = 'SOS' | 'SUPPORTER';
type SupporterType = 'NPO' | 'CORPORATE' | null;
type FormType = 'help_seeker' | 'npo' | 'corporation';

export default function SignupPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formType, setFormType] = useState<FormType>('help_seeker');

  // 困っている人用
  const [helpSeekerData, setHelpSeekerData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  // NPO/企業用
  const [organizationData, setOrganizationData] = useState({
    organizationName: '',
    representativeName: '',
    address: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  // formTypeからroleとsupporter_typeを取得
  const getRoleAndType = (type: FormType): { role: UserRole; supporterType: SupporterType } => {
    switch (type) {
      case 'help_seeker':
        return { role: 'SOS', supporterType: null };
      case 'npo':
        return { role: 'SUPPORTER', supporterType: 'NPO' };
      case 'corporation':
        return { role: 'SUPPORTER', supporterType: 'CORPORATE' };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // パスワード確認
      const password = formType === 'help_seeker'
        ? helpSeekerData.password
        : organizationData.password;
      const confirmPassword = formType === 'help_seeker'
        ? helpSeekerData.confirmPassword
        : organizationData.confirmPassword;

      if (password !== confirmPassword) {
        setError('パスワードが一致しません');
        setIsLoading(false);
        return;
      }

      // 電話番号バリデーション（NPO/企業）
      if (formType !== 'help_seeker') {
        const phoneRegex = /^[0-9-]+$/;
        if (!phoneRegex.test(organizationData.phone)) {
          setError('電話番号は数字とハイフンのみ使用できます');
          setIsLoading(false);
          return;
        }
      }

      const email = formType === 'help_seeker'
        ? helpSeekerData.email
        : organizationData.email;

      const { role, supporterType } = getRoleAndType(formType);

      // 1. Supabase Authでユーザー作成
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { role }
        }
      });

      if (authError) {
        setError(`認証エラー: ${authError.message}`);
        setIsLoading(false);
        return;
      }

      if (!authData.user) {
        setError('ユーザー作成に失敗しました');
        setIsLoading(false);
        return;
      }

      // 2. public.usersテーブルに保存
      const userData = formType === 'help_seeker'
        ? {
          auth_user_id: authData.user.id,
          role,
          supporter_type: null,
          display_name: helpSeekerData.name,
          email,
        }
        : {
          auth_user_id: authData.user.id,
          role,
          supporter_type: supporterType,
          display_name: organizationData.representativeName,
          email,
          phone: organizationData.phone,
          organization_name: organizationData.organizationName,
          address: organizationData.address,
        };

      const { error: dbError } = await supabase
        .from('users')
        .insert([userData]);

      if (dbError) {
        console.error('Database error:', dbError);
        setError(`データベースエラー: ${dbError.message}`);
        setIsLoading(false);
        return;
      }

      // 登録成功
      alert('登録が完了しました！\nメールアドレスに確認メールを送信しました。\nメールを確認してからログインしてください。');
      router.push('/');

    } catch (err) {
      console.error('Signup error:', err);
      setError('登録中にエラーが発生しました');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            SDGsマッチングプラットフォーム
          </CardTitle>
          <CardDescription className="text-center">
            アカウントを作成して、SDGsの達成に貢献しましょう
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* ユーザータイプ選択 */}
            <div className="space-y-3">
              <Label>あなたのタイプを選択してください</Label>
              <RadioGroup
                value={formType}
                onValueChange={(value) => setFormType(value as FormType)}
              >
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-blue-50 transition-colors">
                  <RadioGroupItem value="help_seeker" id="help_seeker" />
                  <Label htmlFor="help_seeker" className="cursor-pointer flex-1">
                    <div className="font-medium">困っている人</div>
                    <div className="text-sm text-gray-500">支援を求めている方</div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-green-50 transition-colors">
                  <RadioGroupItem value="npo" id="npo" />
                  <Label htmlFor="npo" className="cursor-pointer flex-1">
                    <div className="font-medium">NPO/支援組織</div>
                    <div className="text-sm text-gray-500">支援活動を行う団体</div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-orange-50 transition-colors">
                  <RadioGroupItem value="corporation" id="corporation" />
                  <Label htmlFor="corporation" className="cursor-pointer flex-1">
                    <div className="font-medium">企業</div>
                    <div className="text-sm text-gray-500">SDGs活動を公開する企業</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* 困っている人用フォーム */}
            {formType === 'help_seeker' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">
                    お名前 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="山田太郎（ニックネームでも可）"
                    value={helpSeekerData.name}
                    onChange={(e) => setHelpSeekerData({ ...helpSeekerData, name: e.target.value })}
                    required
                  />
                  <p className="text-xs text-gray-500">※ニックネームでも構いません</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">
                    メールアドレス <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@email.com"
                    value={helpSeekerData.email}
                    onChange={(e) => setHelpSeekerData({ ...helpSeekerData, email: e.target.value })}
                    required
                  />
                  <p className="text-xs text-gray-500">※連絡用に使用します（IDとして使用）</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">
                    パスワード <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="8文字以上"
                    value={helpSeekerData.password}
                    onChange={(e) => setHelpSeekerData({ ...helpSeekerData, password: e.target.value })}
                    required
                    minLength={8}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">
                    パスワード（確認） <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="もう一度入力してください"
                    value={helpSeekerData.confirmPassword}
                    onChange={(e) => setHelpSeekerData({ ...helpSeekerData, confirmPassword: e.target.value })}
                    required
                    minLength={8}
                  />
                </div>
              </>
            )}

            {/* NPO/企業用フォーム */}
            {(formType === 'npo' || formType === 'corporation') && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="organizationName">
                    {formType === 'npo' ? '団体名' : '企業名'}{' '}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="organizationName"
                    type="text"
                    placeholder={formType === 'npo' ? 'NPO法人〇〇' : '株式会社〇〇'}
                    value={organizationData.organizationName}
                    onChange={(e) => setOrganizationData({ ...organizationData, organizationName: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="representativeName">
                    代表者名 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="representativeName"
                    type="text"
                    placeholder="山田太郎"
                    value={organizationData.representativeName}
                    onChange={(e) => setOrganizationData({ ...organizationData, representativeName: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">
                    住所 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="address"
                    type="text"
                    placeholder="東京都〇〇区〇〇 1-2-3"
                    value={organizationData.address}
                    onChange={(e) => setOrganizationData({ ...organizationData, address: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">
                    電話番号 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="03-1234-5678"
                    value={organizationData.phone}
                    onChange={(e) => setOrganizationData({ ...organizationData, phone: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="org_email">
                    メールアドレス <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="org_email"
                    type="email"
                    placeholder="info@example.com"
                    value={organizationData.email}
                    onChange={(e) => setOrganizationData({ ...organizationData, email: e.target.value })}
                    required
                  />
                  <p className="text-xs text-gray-500">※IDとして使用します</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="org_password">
                    パスワード <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="org_password"
                    type="password"
                    placeholder="8文字以上"
                    value={organizationData.password}
                    onChange={(e) => setOrganizationData({ ...organizationData, password: e.target.value })}
                    required
                    minLength={8}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="org_confirmPassword">
                    パスワード（確認） <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="org_confirmPassword"
                    type="password"
                    placeholder="もう一度入力してください"
                    value={organizationData.confirmPassword}
                    onChange={(e) => setOrganizationData({ ...organizationData, confirmPassword: e.target.value })}
                    required
                    minLength={8}
                  />
                </div>
              </>
            )}

            {/* エラーメッセージ */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            {/* 登録ボタン */}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
              disabled={isLoading}
            >
              {isLoading ? '登録中...' : 'アカウントを作成'}
            </Button>
          </form>

          {/* ログインリンク */}
          <div className="mt-4 text-center text-sm text-gray-600">
            すでにアカウントをお持ちですか？{' '}
            <a href="/login" className="text-blue-600 hover:underline">
              ログイン
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}