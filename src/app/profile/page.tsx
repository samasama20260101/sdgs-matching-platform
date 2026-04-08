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
    real_name: string;
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
    bio: string | null;
    social_links: {
        website?: string; twitter?: string;
        instagram?: string; facebook?: string; line?: string;
    } | null;
};

// SOSユーザー向け地域セレクト（DBのregionsテーブルから取得）
function SosRegionSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const [regions, setRegions] = useState<{ code: string; name_local: string }[]>([]);
    useEffect(() => {
        fetch('/api/regions?country=JP', { cache: 'no-store' })
            .then(r => r.json())
            .then(d => setRegions(d.regions || []))
            .catch(() => { });
    }, []);
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            <option value="">選択してください（任意）</option>
            {regions.map(r => (
                <option key={r.code} value={r.code}>{r.name_local}</option>
            ))}
        </select>
    );
}

export default function ProfilePage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [userData, setUserData] = useState<UserData | null>(null);

    const [realName, setRealName] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [phone, setPhone] = useState('');
    const [organizationName, setOrganizationName] = useState('');
    const [sosRegionCode, setSosRegionCode] = useState('');
    const [addressData, setAddressData] = useState<AddressFormData>({
        postalCode: '', prefecture: '', city: '', addressLine1: '', addressLine2: '',
    });
    const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
    const [isNationwide, setIsNationwide] = useState(false);
    const [bio, setBio] = useState('');
    const [website, setWebsite] = useState('');
    const [twitter, setTwitter] = useState('');
    const [instagram, setInstagram] = useState('');
    const [facebook, setFacebook] = useState('');
    const [line, setLine] = useState('');

    useEffect(() => {
        const loadUserData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) { router.push('/login'); return; }

                const roleRes = await fetch('/api/auth/get-role', {
                    headers: { 'Authorization': `Bearer ${session.access_token}` },
                });
                const roleData = await roleRes.json();
                if (!roleData.user) {
                    setError('ユーザー情報が見つかりません');
                    setIsLoading(false);
                    return;
                }
                const data = roleData.user;
                setUserData(data);
                setRealName(data.real_name || '');
                setDisplayName(data.display_name || '');
                setPhone(data.phone || '');
                setOrganizationName(data.organization_name || '');
                if (data.role === 'SOS') {
                    setSosRegionCode(data.sos_region_code || '');
                }

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
                        postalCode: data.postal_code || '', prefecture: data.prefecture || '',
                        city: data.city || '', addressLine1: '', addressLine2: '',
                    });
                }

                if (data.role === 'SUPPORTER') {
                    setIsNationwide(data.service_area_nationwide || false);
                    setServiceAreas(data.service_areas || []);
                    setBio(data.bio || '');
                    const sl = data.social_links || {};
                    setWebsite(sl.website || '');
                    setTwitter(sl.twitter || '');
                    setInstagram(sl.instagram || '');
                    setFacebook(sl.facebook || '');
                    setLine(sl.line || '');
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

    const handleSave = async () => {
        setError(null);
        setSuccess(false);
        setIsSaving(true);
        try {
            if (!userData) { setError('ユーザー情報がありません'); setIsSaving(false); return; }
            if (!realName.trim()) { setError(userData.role === 'SOS' ? 'お名前（本名）は必須です' : '代表者名は必須です'); setIsSaving(false); return; }
            if (realName.length > 64) { setError('担当者名は64文字以内で入力してください'); setIsSaving(false); return; }
            if (!displayName.trim()) { setError(userData.role === 'SOS' ? 'ニックネームは必須です' : '表示名は必須です'); setIsSaving(false); return; }
            if (displayName.length > 64) { setError('表示名は64文字以内で入力してください'); setIsSaving(false); return; }
            if (organizationName.length > 64) { setError('組織名は64文字以内で入力してください'); setIsSaving(false); return; }

            if (userData.role === 'SUPPORTER') {
                if (!addressData.prefecture || !addressData.city || !addressData.addressLine1) {
                    setError('サポーターは住所（都道府県・市区町村・番地）の入力が必須です');
                    setIsSaving(false); return;
                }
                if (!isNationwide && serviceAreas.length === 0) {
                    setError('活動地域を少なくとも1つ選択してください');
                    setIsSaving(false); return;
                }
            }

            const addressStructured = (addressData.postalCode || addressData.prefecture || addressData.city) ? {
                country: 'JP', postal_code: addressData.postalCode,
                prefecture: addressData.prefecture, city: addressData.city,
                line1: addressData.addressLine1, line2: addressData.addressLine2,
            } : null;

            const updateData: any = {
                real_name: realName.trim(), display_name: displayName.trim(),
                phone: phone.trim() || null,
                postal_code: addressData.postalCode || null, prefecture: addressData.prefecture || null,
                city: addressData.city || null, address_structured: addressStructured,
                updated_at: new Date().toISOString(),
            };

            if (userData.role === 'SOS') {
                updateData.sos_region_code = sosRegionCode || null;
            }

            if (userData.role === 'SUPPORTER') {
                updateData.organization_name = organizationName.trim() || null;
                updateData.service_area_nationwide = isNationwide;
                updateData.service_areas = serviceAreas;
                updateData.bio = bio.trim() || null;
                const sl: Record<string, string> = {};
                if (website.trim()) sl.website = website.trim();
                if (twitter.trim()) {
                    const tw = twitter.trim();
                    // URLが入力された場合はユーザー名を抽出
                    const twMatch = tw.match(/(?:twitter\.com|x\.com)\/([^/?]+)/);
                    sl.twitter = twMatch ? twMatch[1] : tw.replace('@', '');
                }
                if (instagram.trim()) {
                    const ig = instagram.trim();
                    // URLが入力された場合はユーザー名を抽出
                    const igMatch = ig.match(/instagram\.com\/([^/?]+)/);
                    sl.instagram = igMatch ? igMatch[1] : ig.replace('@', '');
                }
                if (facebook.trim()) sl.facebook = facebook.trim();
                if (line.trim()) sl.line = line.trim();
                updateData.social_links = Object.keys(sl).length > 0 ? sl : null;
            }

            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
                body: JSON.stringify(updateData),
            });
            if (!res.ok) {
                const result = await res.json();
                setError(`更新エラー: ${result.error}`);
                setIsSaving(false); return;
            }

            // サポーターの活動地域は専用APIでも保存（確実性のため二重保存）
            if (userData.role === 'SUPPORTER') {
                const areaRes = await fetch('/api/supporter/service-areas', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
                    body: JSON.stringify({
                        service_areas: serviceAreas,
                        service_area_nationwide: isNationwide,
                    }),
                });
                if (!areaRes.ok) {
                    const areaResult = await areaRes.json();
                    console.error('[profile] service-areas save error:', areaResult.error);
                    setError(`活動地域の保存エラー: ${areaResult.error}`);
                    setIsSaving(false); return;
                }
            }

            setSuccess(true);
            setIsSaving(false);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            console.error('Save error:', err);
            setError('保存中にエラーが発生しました');
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">読み込み中...</p></div>;
    if (!userData) return <div className="min-h-screen flex items-center justify-center"><p className="text-red-500">ユーザー情報が見つかりません</p></div>;

    return (
        <div className="min-h-screen bg-gray-50">
            <Header />
            <main className="max-w-2xl mx-auto px-6 py-8">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-800">プロフィール編集</h1>
                    <p className="text-gray-500 mt-1">登録情報を更新できます</p>
                    {userData.role === 'SUPPORTER' && (
                        <a href={`/supporters/${userData.id}`} target="_blank"
                            className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 mt-2 underline">
                            🌐 公開プロフィールを確認する →
                        </a>
                    )}
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle className="text-base">基本情報</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="realName">{userData.role === 'SOS' ? 'お名前' : '代表者名'} <span className="text-red-500">*</span></Label>
                                <Input id="realName" value={realName} onChange={(e) => setRealName(e.target.value)} placeholder="山田太郎" maxLength={64} />
                                <div className="flex justify-between items-start mt-1">
                                    {userData.role === 'SOS' && <p className="text-xs text-gray-500">※ニックネームでもOKです。サポーターとマッチ後に共有されます（公開されません）</p>}
                                    <p className={`text-xs ml-auto flex-shrink-0 ${realName.length >= 58 ? 'text-orange-500' : 'text-gray-400'}`}>{realName.length} / 64</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="displayName">{userData.role === 'SOS' ? 'ニックネーム' : '表示名'} <span className="text-red-500">*</span></Label>
                                <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={userData.role === 'SOS' ? 'たろう' : '山田太郎'} maxLength={64} />
                                <div className="flex justify-between items-start mt-1">
                                    {userData.role === 'SOS' && <p className="text-xs text-gray-500">※サポーター側に表示される名前です</p>}
                                    <p className={`text-xs ml-auto flex-shrink-0 ${displayName.length >= 58 ? 'text-orange-500' : 'text-gray-400'}`}>{displayName.length} / 64</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">メールアドレス</Label>
                                <Input id="email" type="email" value={userData.email} disabled className="bg-gray-100" />
                                <p className="text-xs text-gray-500">※メールアドレスは変更できません</p>
                            </div>
                            {userData.role === 'SUPPORTER' && (
                                <div className="space-y-2">
                                    <Label htmlFor="organizationName">組織名</Label>
                                    <Input id="organizationName" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} placeholder="NPO法人〇〇 / 株式会社〇〇" maxLength={64} />
                                    <p className={`text-xs text-right mt-1 ${organizationName.length >= 58 ? 'text-orange-500' : 'text-gray-400'}`}>{organizationName.length} / 64</p>
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="phone">電話番号 {userData.role === 'SUPPORTER' && <span className="text-red-500">*</span>}</Label>
                                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03-1234-5678" maxLength={20} />
                                <p className={`text-xs text-right mt-1 ${phone.length >= 18 ? 'text-orange-500' : 'text-gray-400'}`}>{phone.length} / 20</p>
                            </div>
                        </CardContent>
                    </Card>

                    {userData.role === 'SOS' && (
                        <Card>
                            <CardHeader><CardTitle className="text-base">お住まいの地域 <span className="text-xs font-normal text-gray-400">（任意）</span></CardTitle></CardHeader>
                            <CardContent className="space-y-3">
                                <p className="text-sm text-gray-600">💡 お近くのサポーターが優先的に表示されます。住所の詳細は公開されません。</p>
                                <SosRegionSelect value={sosRegionCode} onChange={setSosRegionCode} />
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader><CardTitle className="text-base">住所 {userData.role === 'SUPPORTER' && <span className="text-red-500">*</span>}</CardTitle></CardHeader>
                        <CardContent>
                            {userData.role === 'SOS' ? (
                                <>
                                    <AddressForm countryCode="JP" required={false}
                                        requiredFields={{ postalCode: false, prefecture: false, city: false, addressLine1: false }}
                                        onChange={setAddressData} initialData={addressData} />
                                </>
                            ) : (
                                <>
                                    <p className="text-sm text-gray-600 mb-4">💡 活動拠点の住所を入力してください</p>
                                    <AddressForm countryCode="JP" required={true}
                                        requiredFields={{ postalCode: true, prefecture: true, city: true, addressLine1: true }}
                                        onChange={setAddressData} initialData={addressData} />
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {userData.role === 'SUPPORTER' && (
                        <Card>
                            <CardHeader><CardTitle className="text-base">活動地域 <span className="text-red-500">*</span></CardTitle></CardHeader>
                            <CardContent>
                                <ServiceAreaSelector country="JP"
                                    onChange={(areas, nationwide) => { setServiceAreas(areas); setIsNationwide(nationwide); }}
                                    initialAreas={serviceAreas} initialNationwide={isNationwide} />
                            </CardContent>
                        </Card>
                    )}

                    {/* 公開プロフィール（サポーターのみ） */}
                    {userData.role === 'SUPPORTER' && (
                        <Card className="border-teal-200">
                            <CardHeader>
                                <CardTitle className="text-base">公開プロフィール</CardTitle>
                                <p className="text-xs text-gray-400 mt-1">🌐 ログイン不要のサポーター紹介ページに表示されます</p>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="space-y-2">
                                    <Label htmlFor="bio">自己紹介文</Label>
                                    <textarea
                                        id="bio"
                                        value={bio}
                                        onChange={e => setBio(e.target.value)}
                                        rows={4}
                                        maxLength={500}
                                        placeholder="活動内容や想い、得意な支援分野などを自由に記入してください（500文字以内）"
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                                    />
                                    <p className="text-xs text-gray-400 text-right">{bio.length}/500</p>
                                </div>
                                <div className="space-y-3">
                                    <Label>SNS・外部リンク</Label>
                                    <div className="space-y-3">
                                        {[
                                            { label: '公式サイト', icon: '🌐', value: website, setter: setWebsite, placeholder: 'https://example.org', type: 'url' },
                                            { label: 'X (Twitter)', icon: '✕', value: twitter, setter: setTwitter, placeholder: 'ユーザー名（@なしでもOK）', type: 'text' },
                                            { label: 'Instagram', icon: '📸', value: instagram, setter: setInstagram, placeholder: 'ユーザー名（@なしでもOK）', type: 'text' },
                                            { label: 'Facebook', icon: '👥', value: facebook, setter: setFacebook, placeholder: 'FacebookページURL', type: 'url' },
                                            { label: 'LINE', icon: '💬', value: line, setter: setLine, placeholder: 'LINE公式アカウントID', type: 'text' },
                                        ].map(({ label, icon, value, setter, placeholder, type }) => (
                                            <div key={label}>
                                                <p className="text-xs text-gray-500 mb-1">{icon} {label}</p>
                                                <Input
                                                    value={value}
                                                    onChange={e => setter(e.target.value)}
                                                    placeholder={placeholder}
                                                    type={type}
                                                    maxLength={500}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {success && (
                        <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-teal-600 text-sm">
                            ✅ プロフィールを更新しました
                        </div>
                    )}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3">
                        <Button onClick={handleSave} disabled={isSaving} className="flex-1 bg-blue-600 hover:bg-blue-700">
                            {isSaving ? '保存中...' : '変更を保存'}
                        </Button>
                        <Button variant="outline" onClick={() => router.back()} className="flex-1">
                            キャンセル
                        </Button>
                    </div>
                </div>
            </main>
        </div>
    );
}