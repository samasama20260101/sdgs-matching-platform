'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// 日本の都道府県リスト
const JAPAN_PREFECTURES = [
    '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
    '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
    '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
    '岐阜県', '静岡県', '愛知県', '三重県',
    '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
    '鳥取県', '島根県', '岡山県', '広島県', '山口県',
    '徳島県', '香川県', '愛媛県', '高知県',
    '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
];

export type ServiceArea = {
    country: 'JP' | 'ID';
    prefecture: string;
    city?: string;
};

type ServiceAreaSelectorProps = {
    countryCode: 'JP' | 'ID';
    onChange: (areas: ServiceArea[], isNationwide: boolean) => void;
    initialAreas?: ServiceArea[];
    initialNationwide?: boolean;
};

export default function ServiceAreaSelector({
    countryCode = 'JP',
    onChange,
    initialAreas = [],
    initialNationwide = false,
}: ServiceAreaSelectorProps) {
    const [isNationwide, setIsNationwide] = useState(initialNationwide);
    const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>(initialAreas);
    const [currentPrefecture, setCurrentPrefecture] = useState('');
    const [currentCity, setCurrentCity] = useState('');

    // 全国対応トグル
    const handleNationwideToggle = (checked: boolean) => {
        setIsNationwide(checked);
        if (checked) {
            setServiceAreas([]);
            onChange([], true);
        } else {
            onChange(serviceAreas, false);
        }
    };

    // 地域を追加
    const handleAddArea = () => {
        if (!currentPrefecture) return;

        const newArea: ServiceArea = {
            country: countryCode,
            prefecture: currentPrefecture,
            city: currentCity || undefined,
        };

        // 重複チェック
        const exists = serviceAreas.some(
            (area) =>
                area.prefecture === newArea.prefecture &&
                area.city === newArea.city
        );

        if (!exists) {
            const updated = [...serviceAreas, newArea];
            setServiceAreas(updated);
            onChange(updated, false);
        }

        // フォームリセット
        setCurrentPrefecture('');
        setCurrentCity('');
    };

    // 地域を削除
    const handleRemoveArea = (index: number) => {
        const updated = serviceAreas.filter((_, i) => i !== index);
        setServiceAreas(updated);
        onChange(updated, false);
    };

    return (
        <div className="space-y-4">
            {/* 全国対応チェックボックス */}
            <div className="flex items-center gap-3">
                <input
                    type="checkbox"
                    id="nationwide"
                    checked={isNationwide}
                    onChange={(e) => handleNationwideToggle(e.target.checked)}
                    className="w-4 h-4 text-blue-600"
                />
                <Label htmlFor="nationwide" className="cursor-pointer">
                    全国対応可能
                </Label>
            </div>

            {/* 地域別対応の場合 */}
            {!isNationwide && (
                <>
                    {/* 地域追加フォーム */}
                    <Card className="bg-gray-50">
                        <CardContent className="pt-6 space-y-3">
                            <div className="space-y-2">
                                <Label htmlFor="add-prefecture">
                                    {countryCode === 'JP' ? '都道府県' : 'Province'}
                                </Label>
                                {countryCode === 'JP' ? (
                                    <select
                                        id="add-prefecture"
                                        value={currentPrefecture}
                                        onChange={(e) => setCurrentPrefecture(e.target.value)}
                                        className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                                    >
                                        <option value="">選択してください</option>
                                        {JAPAN_PREFECTURES.map((pref) => (
                                            <option key={pref} value={pref}>
                                                {pref}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        id="add-prefecture"
                                        type="text"
                                        placeholder="Jakarta"
                                        value={currentPrefecture}
                                        onChange={(e) => setCurrentPrefecture(e.target.value)}
                                        className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    />
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="add-city">
                                    {countryCode === 'JP' ? '市区町村（任意）' : 'City (Optional)'}
                                </Label>
                                <input
                                    id="add-city"
                                    type="text"
                                    placeholder={countryCode === 'JP' ? '渋谷区' : 'Central Jakarta'}
                                    value={currentCity}
                                    onChange={(e) => setCurrentCity(e.target.value)}
                                    className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                />
                                <p className="text-xs text-gray-500">
                                    空欄の場合、都道府県全域が対象になります
                                </p>
                            </div>

                            <Button
                                type="button"
                                onClick={handleAddArea}
                                disabled={!currentPrefecture}
                                className="w-full bg-blue-600 hover:bg-blue-700"
                            >
                                ＋ 活動地域を追加
                            </Button>
                        </CardContent>
                    </Card>

                    {/* 登録済み地域リスト */}
                    {serviceAreas.length > 0 && (
                        <div className="space-y-2">
                            <Label>活動地域（{serviceAreas.length}件）</Label>
                            <div className="space-y-2">
                                {serviceAreas.map((area, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
                                    >
                                        <span className="text-sm">
                                            {area.prefecture}
                                            {area.city && ` ${area.city}`}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveArea(index)}
                                            className="text-red-500 hover:text-red-700 text-sm"
                                        >
                                            削除
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 地域未設定の警告 */}
                    {serviceAreas.length === 0 && (
                        <p className="text-sm text-orange-600 bg-orange-50 p-3 rounded-lg">
                            ⚠️ 活動地域を少なくとも1つ追加してください
                        </p>
                    )}
                </>
            )}
        </div>
    );
}