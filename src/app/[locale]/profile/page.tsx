'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { supabase } from '@/lib/supabase/client';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AddressForm, { AddressFormData } from '@/components/form/AddressForm';
import ServiceAreaSelector, { ServiceArea } from '@/components/form/ServiceAreaSelector';
import { localeLabels, locales, type AppLocale } from '@/i18n/routing';

type UserData = {
    id: string;
    auth_user_id: string;
    role: 'SOS' | 'SUPPORTER';
    real_name: string;
    display_name: string;
    email: string;
    phone: string | null;
    locale: AppLocale;
    organization_phone?: string | null;
    membership_department?: string | null;
    membership_external_phone?: string | null;
    membership_phone_extension?: string | null;
    organization_name: string | null;
    postal_code?: string | null;
    prefecture?: string | null;
    city?: string | null;
    address_structured?: {
        line1?: string;
        line2?: string;
    } | null;
    service_areas: ServiceArea[];
    service_area_nationwide: boolean;
    organization_id?: string | null;
    organization_role?: 'OWNER' | 'ADMIN' | 'MEMBER' | null;
    bio: string | null;
    social_links: {
        website?: string; twitter?: string;
        instagram?: string; facebook?: string; line?: string;
    } | null;
};
type ProfileUpdateData = {
    real_name: string;
    display_name: string;
    phone: string | null;
    locale?: AppLocale;
    postal_code?: string | null;
    prefecture?: string | null;
    city?: string | null;
    address_structured?: {
        country: 'JP';
        postal_code: string;
        prefecture: string;
        city: string;
        line1: string;
        line2: string;
    } | null;
    updated_at: string;
    sos_region_code?: string | null;
    organization_name?: string | null;
    organization_phone?: string | null;
    membership_department?: string | null;
    membership_external_phone?: string | null;
    membership_phone_extension?: string | null;
    service_area_nationwide?: boolean;
    service_areas?: ServiceArea[];
    bio?: string | null;
    social_links?: Record<string, string> | null;
};

// SOSユーザー向け地域セレクト（DBのregionsテーブルから取得）
function SosRegionSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const t = useTranslations('common.profile');
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
            <option value="">{t('regionPlaceholder')}</option>
            {regions.map(r => (
                <option key={r.code} value={r.code}>{r.name_local}</option>
            ))}
        </select>
    );
}

export default function ProfilePage() {
    const t = useTranslations('common.profile');
    const tForm = useTranslations('common.form');
    const tActions = useTranslations('common.actions');
    const router = useRouter();
    const requestLocale = useLocale() as AppLocale;
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [userData, setUserData] = useState<UserData | null>(null);

    const [realName, setRealName] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [phone, setPhone] = useState('');
    const [locale, setLocale] = useState<AppLocale>(requestLocale);
    const [organizationName, setOrganizationName] = useState('');
    const [organizationPhone, setOrganizationPhone] = useState('');
    const [membershipDepartment, setMembershipDepartment] = useState('');
    const [membershipExternalPhone, setMembershipExternalPhone] = useState('');
    const [membershipPhoneExtension, setMembershipPhoneExtension] = useState('');
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
                if (roleRes.status === 403) {
                    if (roleData.code === 'ACCOUNT_SUSPENDED' || roleData.error === 'Account suspended') {
                        await supabase.auth.signOut();
                        router.push('/login?reason=suspended');
                        return;
                    }
                }
                if (!roleData.user) {
                    setError(t('errorNoUser'));
                    setIsLoading(false);
                    return;
                }
                const data = roleData.user;
                if (data.role === 'SUPPORTER' && !data.organization_id) {
                    router.push('/supporter/no-organization');
                    return;
                }
                setUserData(data);
                setRealName(data.real_name || '');
                setDisplayName(data.display_name || '');
                setPhone(data.phone || '');
                setLocale(data.locale || requestLocale);
                setOrganizationName(data.organization_name || '');
                setOrganizationPhone(data.organization_phone || '');
                setMembershipDepartment(data.membership_department || '');
                setMembershipExternalPhone(data.membership_external_phone || '');
                setMembershipPhoneExtension(data.membership_phone_extension || '');
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
                setError(t('errorLoad'));
                setIsLoading(false);
            }
        };
        loadUserData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router, requestLocale]);

    const canEditOrganization = userData?.role === 'SUPPORTER' && userData.organization_role === 'OWNER';

    const handleSave = async () => {
        setError(null);
        setSuccess(false);
        setIsSaving(true);
        try {
            if (!userData) { setError(t('errorNoUser')); setIsSaving(false); return; }
            if (!realName.trim()) { setError(userData.role === 'SOS' ? t('errorNameRequired') : '担当者名は必須です'); setIsSaving(false); return; }
            if (realName.length > 64) { setError(t('errorTooLong')); setIsSaving(false); return; }
            if (!displayName.trim()) { setError(userData.role === 'SOS' ? t('errorNicknameRequired') : '表示名は必須です'); setIsSaving(false); return; }
            if (displayName.length > 64) { setError(t('errorTooLong')); setIsSaving(false); return; }
            if (canEditOrganization && organizationName.length > 64) { setError('組織名は64文字以内で入力してください'); setIsSaving(false); return; }

            if (canEditOrganization) {
                if (!addressData.prefecture || !addressData.city || !addressData.addressLine1) {
                    setError('サポーターは住所（都道府県・市区町村・番地）の入力が必須です');
                    setIsSaving(false); return;
                }
                if (!isNationwide && serviceAreas.length === 0) {
                    setError('活動地域を少なくとも1つ選択してください');
                    setIsSaving(false); return;
                }
            }

            const addressStructured: ProfileUpdateData['address_structured'] = (addressData.postalCode || addressData.prefecture || addressData.city) ? {
                country: 'JP', postal_code: addressData.postalCode,
                prefecture: addressData.prefecture, city: addressData.city,
                line1: addressData.addressLine1, line2: addressData.addressLine2,
            } : null;

            const updateData: ProfileUpdateData = {
                real_name: realName.trim(), display_name: displayName.trim(),
                phone: phone.trim() || null,
                locale,
                updated_at: new Date().toISOString(),
            };

            if (userData.role === 'SOS') {
                updateData.sos_region_code = sosRegionCode || null;
                updateData.postal_code = addressData.postalCode || null;
                updateData.prefecture = addressData.prefecture || null;
                updateData.city = addressData.city || null;
                updateData.address_structured = addressStructured;
            }

            if (userData.role === 'SUPPORTER') {
                updateData.membership_department = membershipDepartment.trim() || null;
                updateData.membership_external_phone = membershipExternalPhone.trim() || null;
                updateData.membership_phone_extension = membershipPhoneExtension.trim() || null;
            }

            if (canEditOrganization) {
                updateData.organization_name = organizationName.trim() || null;
                updateData.organization_phone = organizationPhone.trim() || null;
                updateData.postal_code = addressData.postalCode || null;
                updateData.prefecture = addressData.prefecture || null;
                updateData.city = addressData.city || null;
                updateData.address_structured = addressStructured;
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
                setError(t('errorUpdate', { message: result.error }));
                setIsSaving(false); return;
            }

            // サポーターの活動地域は専用APIでも保存（確実性のため二重保存）
            if (canEditOrganization) {
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
            setError(t('errorSave'));
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">{tForm('loading')}</p></div>;
    if (!userData) return <div className="min-h-screen flex items-center justify-center"><p className="text-red-500">{t('errorNoUser')}</p></div>;

    return (
        <div className="min-h-screen bg-gray-50">
            <Header />
            <main className="max-w-2xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-800">{t('title')}</h1>
                    <p className="text-gray-500 mt-1">{t('subtitle')}</p>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">{t('languageTitle')}</CardTitle>
                            <p className="text-xs text-gray-500 mt-1">{t('languageNote')}</p>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Label htmlFor="locale">{t('languageLabel')}</Label>
                            <select
                                id="locale"
                                value={locale}
                                onChange={(e) => setLocale(e.target.value as AppLocale)}
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {locales.map((option) => (
                                    <option key={option} value={option}>{localeLabels[option]}</option>
                                ))}
                            </select>
                        </CardContent>
                    </Card>

                    {userData.role === 'SOS' ? (
                        <>
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">{t('privateContactTitle')}</CardTitle>
                                    <p className="text-xs text-gray-500 mt-1">{t('privateContactNote')}</p>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="realName">{t('nameLabel')} <span className="text-red-500">*</span></Label>
                                        <Input id="realName" value={realName} onChange={(e) => setRealName(e.target.value)} placeholder={t('namePlaceholder')} maxLength={64} />
                                        <div className="flex justify-between items-start mt-1">
                                            <p className="text-xs text-gray-500">{t('nameNote')}</p>
                                            <p className={`text-xs ml-auto flex-shrink-0 ${realName.length >= 58 ? 'text-orange-500' : 'text-gray-400'}`}>{realName.length} / 64</p>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email">{tForm('email')}</Label>
                                        <Input id="email" type="email" value={userData.email} disabled className="bg-gray-100" />
                                        <p className="text-xs text-gray-500">{t('emailNote')}</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">{t('phoneLabel')} <span className="text-xs font-normal text-gray-400">{t('phoneOptionalPrivate')}</span></Label>
                                        <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03-1234-5678" maxLength={20} />
                                        <p className="text-xs text-gray-500">{t('phoneNote')}</p>
                                        <p className={`text-xs text-right mt-1 ${phone.length >= 18 ? 'text-orange-500' : 'text-gray-400'}`}>{phone.length} / 20</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">{t('publicInfoTitle')}</CardTitle>
                                    <p className="text-xs text-gray-500 mt-1">{t('publicInfoNote')}</p>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="displayName">{t('nicknameLabel')} <span className="text-red-500">*</span></Label>
                                        <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('nicknamePlaceholder')} maxLength={64} />
                                        <div className="flex justify-between items-start mt-1">
                                            <p className="text-xs text-gray-500">{t('nicknameNote')}</p>
                                            <p className={`text-xs ml-auto flex-shrink-0 ${displayName.length >= 58 ? 'text-orange-500' : 'text-gray-400'}`}>{displayName.length} / 64</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    ) : (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">あなたの担当者情報</CardTitle>
                                <p className="text-xs text-gray-500 mt-1">団体に所属する担当者個人の情報です。団体情報とは別に管理されます。</p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="realName">担当者名 <span className="text-red-500">*</span></Label>
                                    <Input id="realName" value={realName} onChange={(e) => setRealName(e.target.value)} placeholder="山田太郎" maxLength={64} />
                                    <p className={`text-xs text-right mt-1 ${realName.length >= 58 ? 'text-orange-500' : 'text-gray-400'}`}>{realName.length} / 64</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="displayName">表示名 <span className="text-red-500">*</span></Label>
                                    <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="山田太郎" maxLength={64} />
                                    <p className={`text-xs text-right mt-1 ${displayName.length >= 58 ? 'text-orange-500' : 'text-gray-400'}`}>{displayName.length} / 64</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">メールアドレス</Label>
                                    <Input id="email" type="email" value={userData.email} disabled className="bg-gray-100" />
                                    <p className="text-xs text-gray-500">※メールアドレスは変更できません</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">担当者個人の電話番号 <span className="text-xs font-normal text-gray-400">（任意）</span></Label>
                                    <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03-1234-5678" maxLength={20} />
                                    <p className="text-xs text-gray-500">※団体代表電話は下の「団体連絡先」で管理します。</p>
                                    <p className={`text-xs text-right mt-1 ${phone.length >= 18 ? 'text-orange-500' : 'text-gray-400'}`}>{phone.length} / 20</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="membershipDepartment">部署・所属</Label>
                                    <Input id="membershipDepartment" value={membershipDepartment} onChange={(e) => setMembershipDepartment(e.target.value)} maxLength={100} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="membershipExternalPhone">外線番号</Label>
                                    <Input id="membershipExternalPhone" type="tel" value={membershipExternalPhone} onChange={(e) => setMembershipExternalPhone(e.target.value)} maxLength={30} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="membershipPhoneExtension">内線番号</Label>
                                    <Input id="membershipPhoneExtension" value={membershipPhoneExtension} onChange={(e) => setMembershipPhoneExtension(e.target.value)} maxLength={30} />
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {canEditOrganization && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">団体情報</CardTitle>
                                <p className="text-xs text-gray-500 mt-1">団体として管理する情報です。担当者個人の情報とは別に保存されます。</p>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="organizationName">団体名</Label>
                                    <Input id="organizationName" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} placeholder="NPO法人〇〇 / 株式会社〇〇" maxLength={64} />
                                    <p className={`text-xs text-right mt-1 ${organizationName.length >= 58 ? 'text-orange-500' : 'text-gray-400'}`}>{organizationName.length} / 64</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="organizationPhone">団体代表電話番号</Label>
                                    <Input id="organizationPhone" type="tel" value={organizationPhone} onChange={(e) => setOrganizationPhone(e.target.value)} placeholder="03-1234-5678" maxLength={30} />
                                    <p className="text-xs text-gray-500">公開・運営連絡に使う団体の代表電話です。担当者個人の電話番号、所属メンバーの外線・内線とは別に管理されます。</p>
                                </div>
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold text-gray-800">団体所在地 <span className="text-red-500">*</span></h3>
                                    <p className="text-sm text-gray-600">団体の所在地・活動拠点を入力してください。担当者個人の住所は入力しないでください。</p>
                                    <AddressForm countryCode="JP" required={true}
                                        requiredFields={{ postalCode: true, prefecture: true, city: true, addressLine1: true }}
                                        onChange={setAddressData} initialData={addressData} />
                                </div>
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold text-gray-800">活動地域 <span className="text-red-500">*</span></h3>
                                    <ServiceAreaSelector country="JP"
                                        onChange={(areas, nationwide) => { setServiceAreas(areas); setIsNationwide(nationwide); }}
                                        initialAreas={serviceAreas} initialNationwide={isNationwide} />
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {userData.role === 'SOS' && (
                        <Card>
                            <CardHeader><CardTitle className="text-base">{t('regionTitle')} <span className="text-xs font-normal text-teal-600">{t('regionRecommended')}</span></CardTitle></CardHeader>
                            <CardContent className="space-y-3">
                                <p className="text-sm text-gray-600">{t('regionNote')}</p>
                                <SosRegionSelect value={sosRegionCode} onChange={setSosRegionCode} />
                            </CardContent>
                        </Card>
                    )}

                    {userData.role === 'SOS' && <Card>
                        <CardHeader><CardTitle className="text-base">{t('addressTitle')} <span className="text-xs font-normal text-gray-400">{t('addressOptional')}</span></CardTitle></CardHeader>
                        <CardContent>
                            <p className="text-sm text-gray-600 mb-4">{t('addressNote')}</p>
                            <AddressForm countryCode="JP" required={false}
                                requiredFields={{ postalCode: false, prefecture: false, city: false, addressLine1: false }}
                                onChange={setAddressData} initialData={addressData} />
                        </CardContent>
                    </Card>}

                    {/* 公開プロフィール（サポーターのみ） */}
                    {canEditOrganization && (
                        <Card className="border-teal-200">
                            <CardHeader>
                                <CardTitle className="text-base">公開プロフィール</CardTitle>
                                <p className="text-xs text-gray-400 mt-1">🌐 ログイン不要のサポーター紹介ページに表示されます</p>
                                <a href={`/supporters/${userData.organization_id}`} target="_blank"
                                    className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 mt-2 underline">
                                    団体公開ページを確認する →
                                </a>
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
                            {t('updated')}
                        </div>
                    )}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3">
                        <Button onClick={handleSave} disabled={isSaving} className="flex-1 bg-blue-600 hover:bg-blue-700">
                            {isSaving ? tForm('saving') : t('save')}
                        </Button>
                        <Button variant="outline" onClick={() => router.back()} className="flex-1">
                            {tActions('cancel')}
                        </Button>
                    </div>
                </div>
            </main>
        </div>
    );
}
