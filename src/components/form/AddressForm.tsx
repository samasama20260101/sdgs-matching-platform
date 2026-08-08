'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { fetchAddressFromZipcode, formatZipcode, isValidJapanZipcode } from '@/lib/utils/zipcode';

type AddressFormProps = {
    countryCode: 'JP' | 'ID';
    required?: boolean;
    onChange: (data: AddressFormData) => void;
    initialData?: Partial<AddressFormData>;
    // 🆕 フィールドごとの必須設定
    requiredFields?: {
        postalCode?: boolean;
        prefecture?: boolean;
        city?: boolean;
        addressLine1?: boolean;
    };
};

export type AddressFormData = {
    postalCode: string;
    prefecture: string;
    city: string;
    addressLine1: string;
    addressLine2: string;
};

export default function AddressForm({
    countryCode = 'JP',
    required = false,
    onChange,
    initialData = {},
    requiredFields = {}
}: AddressFormProps) {
    const t = useTranslations('common.address');
    const [formData, setFormData] = useState<AddressFormData>({
        postalCode: initialData.postalCode || '',
        prefecture: initialData.prefecture || '',
        city: initialData.city || '',
        addressLine1: initialData.addressLine1 || '',
        addressLine2: initialData.addressLine2 || '',
    });

    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    // デフォルトの必須設定
    const fieldRequired = {
        postalCode: requiredFields.postalCode ?? required,
        prefecture: requiredFields.prefecture ?? required,
        city: requiredFields.city ?? required,
        addressLine1: requiredFields.addressLine1 ?? required,
    };

    // フォームデータ更新
    const updateField = (field: keyof AddressFormData, value: string) => {
        const newData = { ...formData, [field]: value };
        setFormData(newData);
        onChange(newData);
    };

    // 郵便番号から住所を検索
    const handleZipcodeSearch = async () => {
        setSearchError(null);

        // 郵便番号の妥当性チェック（日本の場合）
        if (countryCode === 'JP' && !isValidJapanZipcode(formData.postalCode)) {
            setSearchError(t('errorZipFormat'));
            return;
        }

        setIsSearching(true);

        try {
            if (countryCode === 'JP') {
                // サーバーサイドプロキシ経由でCORSを回避
                const cleanZip = formData.postalCode.replace(/[^0-9]/g, '');
                const res = await fetch(`/api/zipcode?zipcode=${cleanZip}`);
                if (!res.ok) {
                    setSearchError(t('errorZipNotFound'));
                    return;
                }
                const addressData = await res.json();
                const newData = {
                    ...formData,
                    postalCode: formatZipcode(formData.postalCode),
                    prefecture: addressData.prefecture,
                    city: addressData.city,
                };
                setFormData(newData);
                onChange(newData);
            } else {
                const addressData = await fetchAddressFromZipcode(
                    formData.postalCode,
                    countryCode
                );
                if (addressData) {
                    const newData = {
                        ...formData,
                        prefecture: addressData.prefecture,
                        city: addressData.city,
                    };
                    setFormData(newData);
                    onChange(newData);
                } else {
                    setSearchError(t('errorZipNotFound'));
                }
            }
        } catch {
            setSearchError(t('errorZipFetch'));
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* 郵便番号 */}
            <div className="space-y-2">
                <Label htmlFor="postalCode">
                    {t('postalCode')} {fieldRequired.postalCode && <span className="text-red-500">*</span>}
                </Label>
                <div className="flex gap-2">
                    <input
                        id="postalCode"
                        type="text"
                        placeholder={countryCode === 'JP' ? '1234567 または 123-4567' : '12345'}
                        className="flex-1 p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                        value={formData.postalCode}
                        onChange={(e) => updateField('postalCode', e.target.value)}
                        required={fieldRequired.postalCode}
                        maxLength={countryCode === 'JP' ? 8 : 5}
                    />
                    <Button
                        type="button"
                        onClick={handleZipcodeSearch}
                        disabled={isSearching || !formData.postalCode}
                        className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
                    >
                        {isSearching ? t('searching') : t('search')}
                    </Button>
                </div>
                {searchError && (
                    <p className="text-xs text-red-500">{searchError}</p>
                )}
                {countryCode === 'JP' && (
                    <p className="text-xs text-gray-400">
                        {t('postalHint')}
                    </p>
                )}
            </div>

            {/* 都道府県 */}
            <div className="space-y-2">
                <Label htmlFor="prefecture">
                    {countryCode === 'JP' ? t('prefecture') : 'Province'}
                    {fieldRequired.prefecture && <span className="text-red-500">*</span>}
                </Label>
                <input
                    id="prefecture"
                    type="text"
                    placeholder={countryCode === 'JP' ? '東京都' : 'Jakarta'}
                    className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    value={formData.prefecture}
                    onChange={(e) => updateField('prefecture', e.target.value)}
                    required={fieldRequired.prefecture}
                    maxLength={50}
                />
            </div>

            {/* 市区町村 */}
            <div className="space-y-2">
                <Label htmlFor="city">
                    {countryCode === 'JP' ? t('city') : 'City'}
                    {fieldRequired.city && <span className="text-red-500">*</span>}
                </Label>
                <input
                    id="city"
                    type="text"
                    placeholder={countryCode === 'JP' ? '渋谷区' : 'Central Jakarta'}
                    className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    value={formData.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    required={fieldRequired.city}
                    maxLength={50}
                />
            </div>

            {/* 番地・建物名 */}
            <div className="space-y-2">
                <Label htmlFor="addressLine1">
                    {t('line1')}
                    {fieldRequired.addressLine1 && (
                        <span className="text-red-500">*</span>
                    )}
                </Label>
                <input
                    id="addressLine1"
                    type="text"
                    placeholder={countryCode === 'JP' ? '1-2-3 サンプルビル4F' : 'Jl. Sudirman No. 123'}
                    className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    value={formData.addressLine1}
                    onChange={(e) => updateField('addressLine1', e.target.value)}
                    required={fieldRequired.addressLine1}
                    maxLength={100}
                />
                {!fieldRequired.addressLine1 && (
                    <p className="text-xs text-gray-500">
                        {t('line1Hint')}
                    </p>
                )}
            </div>

            {/* 建物名・部屋番号（常に任意） */}
            <div className="space-y-2">
                <Label htmlFor="addressLine2">
                    {t('line2')}
                </Label>
                <input
                    id="addressLine2"
                    type="text"
                    placeholder={countryCode === 'JP' ? '101号室' : 'Room 101'}
                    className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    value={formData.addressLine2}
                    onChange={(e) => updateField('addressLine2', e.target.value)}
                    maxLength={100}
                />
            </div>
        </div>
    );
}
