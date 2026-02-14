'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AddressForm, { AddressFormData } from '@/components/form/AddressForm';
import ServiceAreaSelector, { ServiceArea } from '@/components/form/ServiceAreaSelector';

type UserData = {
    id: string;
    auth_user_id: string;
    role: 'SOS' | 'SUPPORTER';
    display_name: string;
    email: string;
    phone: string | null;
    organization_name: string | null;
    postal_code: string | null;
    prefecture: string | null;
    city: string | null;
    address_structured: any;
    service_areas: any;
    service_area_nationwide: boolean;
};

export default function ProfilePage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [userData, setUserData] = useState<UserData | null>(null);

    // 基本情報
    const [displayName, setDisplayName] = useState('');
    const [phone, setPhone] = useState('');
    const [organizationName, setOrganizationName] = useState('');

    // 住所情報
    const [addressData, setAddressData] = useState<AddressFormData>({
        postalCode: '',
        prefecture: '',
        city: '',
        addressLine1: '',
        addressLine2: '',
    });

    // サポーター活動地域
    const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
    const [isNationwide, setIsNationwide] = useState(false);

    // データ読み込み
    useEffect(() => {
        const loadUserData = async () => {
            try {
                // ログイン確認
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    router.push('/login');
                    return;
                }

                // ユーザー情報取得
                const { data, error: fetchError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('auth_user_id', session.user.id)
                    .single();

                if (fetchError || !data) {
                    setError('ユーザー情報の取得に失敗しました');
                    setIsLoading(false);
                    return;
                }

                setUserData(data);

                // フォームに初期値を設定
                setDisplayName(data.display_name || '');
                setPhone(data.phone || '');
                setOrganizationName(data.organization_name || '');

                // 住所データを復元
                if (data.address_structured) {
                    setAddressData({
                        postalCode: data.postal_code || '',
                        prefecture: data.prefecture || '',
                        city: data.city || '',
                        addressLine1: data.address_structured.line1 || '',
                        addressLine2: data.address_structured.line2 || '',
                    });
                } else {
                    setAddressData({
                        postalCode: data.postal_code || '',
                        prefecture: data.prefecture || '',
                        city: data.city || '',
                        addressLine1: '',
                        addressLine2: '',
                    });
                }

                // サポーターの活動地域を復元
                if (data.role === 'SUPPORTER') {
                    setIsNationwide(data.service_area_nationwide || false);
                    setServiceAreas(data.service_areas || []);
                }

                setIsLoading(false);
            } catch (err) {
                console.error('Load error:', err);
                setError('データの読み込みに失敗しました');
                setIsLoading(false);
            }
        };

        loadUserData();
    }, [router]);

    // 保存処理
    const handleSave = async () => {
        setError(null);
        setSuccess(false);
        setIsSaving(true);

        try {
            if (!userData) {
                setError('ユーザー情報がありません');
                setIsSaving(false);
                return;
            }

            // バリデーション
            if (!displayName.trim()) {
                setError('表示名は必須です');
                setIsSaving(false);
                return;
            }

            // サポーターの場合の追加バリデーション
            if (userData.role === 'SUPPORTER') {
                if (!addressData.prefecture || !addressData.city || !addressData.addressLine1) {
                    setError('サポーターは住所（都道府県・市区町村・番地）の入力が必須です');
                    setIsSaving(false);
                    return;
                }

                if (!isNationwide && serviceAreas.length === 0) {
                    setError('活動地域を少なくとも1つ選択してください');
                    setIsSaving(false);
                    return;
                }
            }

            // 構造化住所データを作成
            const addressStructured = (addressData.postalCode || addressData.prefecture || addressData.city) ? {
                country: 'JP',
                postal_code: addressData.postalCode,
                prefecture: addressData.prefecture,
                city: addressData.city,
                line1: addressData.addressLine1,
                line2: addressData.addressLine2,
            } : null;

            // 更新データ
            const updateData: any = {
                display_name: displayName.trim(),
                phone: phone.trim() || null,
                postal_code: addressData.postalCode || null,
                prefecture: addressData.prefecture || null,
                city: addressData.city || null,
                address_structured: addressStructured,
                updated_at: new Date().toISOString(),
            };

            // サポーター固有のフィールド
            if (userData.role === 'SUPPORTER') {
                updateData.organization_name = organizationName.trim() || null;
                updateData.service_area_nationwide = isNationwide;
                updateData.service_areas = serviceAreas.length > 0 ? serviceAreas : null;
            }

            // データベース更新
            const { error: updateError } = await supabase
                .from('users')
                .update(updateData)
                .eq('id', userData.id);

            if (updateError) {
                console.error('Update error:', updateError);
                setError(`更新エラー: ${updateError.message}`);
                setIsSaving(false);
                return;
            }

            setSuccess(true);
            setIsSaving(false);

            // 成功メッセージを3秒後に消す
            setTimeout(() => setSuccess(false), 3000);

        } catch (err) {
            console.error('Save error:', err);
            setError('保存中にエラーが発生しました');
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-gray-500">読み込み中...</p>
            </div>
        );
    }

    if (!userData) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-red-500">ユーザー情報が見つかりません</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Header />

            <main className="max-w-2xl mx-auto px-6 py-8">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-800">
                        プロフィール編集
                    </h1>
                    <p className="text-gray-500 mt-1">
                        登録情報を更新できます
                    </p>
                </div>

                <div className="space-y-6">
                    {/* 基本情報 */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">基本情報</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* 表示名 */}
                            <div className="space-y-2">
                                <Label htmlFor="displayName">
                                    表示名 <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="displayName"
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="山田太郎"
                                />
                            </div>

                            {/* メールアドレス（読み取り専用） */}
                            <div className="space-y-2">
                                <Label htmlFor="email">
                                    メールアドレス
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={userData.email}
                                    disabled
                                    className="bg-gray-100"
                                />
                                <p className="text-xs text-gray-500">
                                    ※メールアドレスは変更できません
                                </p>
                            </div>

                            {/* 組織名（サポーターのみ） */}
                            {userData.role === 'SUPPORTER' && (
                                <div className="space-y-2">
                                    <Label htmlFor="organizationName">
                                        組織名
                                    </Label>
                                    <Input
                                        id="organizationName"
                                        type="text"
                                        value={organizationName}
                                        onChange={(e) => setOrganizationName(e.target.value)}
                                        placeholder="NPO法人〇〇 / 株式会社〇〇"
                                    />
                                </div>
                            )}

                            {/* 電話番号（サポーターのみ必須） */}
                            <div className="space-y-2">
                                <Label htmlFor="phone">
                                    電話番号 {userData.role === 'SUPPORTER' && <span className="text-red-500">*</span>}
                                </Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="03-1234-5678"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* 住所情報 */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">
                                住所 {userData.role === 'SUPPORTER' && <span className="text-red-500">*</span>}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {userData.role === 'SOS' ? (
                                <>
                                    <p className="text-sm text-gray-600 mb-4">
                                        💡 郵便番号を入力すると、お近くのサポーターが優先的に表示されます。<br />
                                        都道府県・市区町村までの入力でもマッチング可能です。
                                    </p>
                                    <AddressForm
                                        countryCode="JP"
                                        required={false}
                                        requiredFields={{
                                            postalCode: false,
                                            prefecture: false,
                                            city: false,
                                            addressLine1: false,
                                        }}
                                        onChange={setAddressData}
                                        initialData={addressData}
                                    />
                                </>
                            ) : (
                                <>
                                    <p className="text-sm text-gray-600 mb-4">
                                        💡 活動拠点の住所を入力してください
                                    </p>
                                    <AddressForm
                                        countryCode="JP"
                                        required={true}
                                        requiredFields={{
                                            postalCode: true,
                                            prefecture: true,
                                            city: true,
                                            addressLine1: true,
                                        }}
                                        onChange={setAddressData}
                                        initialData={addressData}
                                    />
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* 活動地域（サポーターのみ） */}
                    {userData.role === 'SUPPORTER' && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">
                                    活動地域 <span className="text-red-500">*</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ServiceAreaSelector
                                    countryCode="JP"
                                    onChange={(areas, nationwide) => {
                                        setServiceAreas(areas);
                                        setIsNationwide(nationwide);
                                    }}
                                    initialAreas={serviceAreas}
                                    initialNationwide={isNationwide}
                                />
                            </CardContent>
                        </Card>
                    )}

                    {/* 成功メッセージ */}
                    {success && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
                            ✅ プロフィールを更新しました
                        </div>
                    )}

                    {/* エラーメッセージ */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    {/* 保存ボタン */}
                    <div className="flex gap-3">
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                        >
                            {isSaving ? '保存中...' : '変更を保存'}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => router.back()}
                            className="flex-1"
                        >
                            キャンセル
                        </Button>
                    </div>
                </div>
            </main>
        </div>
    );
}