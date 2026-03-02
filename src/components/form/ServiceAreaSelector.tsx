'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export type Region = {
    code: string;
    country: string;
    level: string;
    name_local: string;
    name_en: string;
};

export type ServiceArea = {
    region_code: string;
    country: string;
    name_local?: string;
    name_en?: string;
};

type ServiceAreaSelectorProps = {
    country?: string;
    onChange: (areas: ServiceArea[], isNationwide: boolean) => void;
    initialAreas?: ServiceArea[];
    initialNationwide?: boolean;
};

export default function ServiceAreaSelector({
    country = 'JP',
    onChange,
    initialAreas = [],
    initialNationwide = false,
}: ServiceAreaSelectorProps) {
    const [isNationwide, setIsNationwide] = useState(initialNationwide);
    const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>(initialAreas);
    const [regions, setRegions] = useState<Region[]>([]);
    const [selectedCode, setSelectedCode] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // 非同期でinitialAreasが渡ってきたときに同期する
    useEffect(() => {
        if (initialAreas.length > 0) {
            setServiceAreas(initialAreas);
        }
    }, [initialAreas.length]);

    useEffect(() => {
        setIsNationwide(initialNationwide);
    }, [initialNationwide]);

    useEffect(() => {
        fetch(`/api/regions?country=${country}`, { cache: 'no-store' })
            .then(r => r.json())
            .then(d => { setRegions(d.regions || []); setIsLoading(false); })
            .catch(() => setIsLoading(false));
    }, [country]);

    const handleNationwideToggle = (checked: boolean) => {
        setIsNationwide(checked);
        if (checked) { setServiceAreas([]); onChange([], true); }
        else { onChange(serviceAreas, false); }
    };

    const handleAddArea = () => {
        if (!selectedCode) return;
        const region = regions.find(r => r.code === selectedCode);
        if (!region) return;
        const newArea: ServiceArea = {
            region_code: region.code,
            country: region.country,
            name_local: region.name_local,
            name_en: region.name_en,
        };
        if (!serviceAreas.some(a => a.region_code === newArea.region_code)) {
            const updated = [...serviceAreas, newArea];
            setServiceAreas(updated);
            onChange(updated, false);
        }
        setSelectedCode('');
    };

    const handleRemoveArea = (index: number) => {
        const updated = serviceAreas.filter((_, i) => i !== index);
        setServiceAreas(updated);
        onChange(updated, false);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <input
                    type="checkbox" id="nationwide" checked={isNationwide}
                    onChange={(e) => handleNationwideToggle(e.target.checked)}
                    className="w-4 h-4 text-blue-600"
                />
                <Label htmlFor="nationwide" className="cursor-pointer">
                    {country === 'JP' ? '全国対応可能' : 'Seluruh Indonesia'}
                </Label>
            </div>

            {!isNationwide && (
                <>
                    <Card className="bg-gray-50">
                        <CardContent className="pt-6 space-y-3">
                            <div className="space-y-2">
                                <Label htmlFor="add-region">
                                    {country === 'JP' ? '都道府県' : 'Provinsi'}
                                </Label>
                                {isLoading ? (
                                    <p className="text-sm text-gray-400">読み込み中...</p>
                                ) : (
                                    <select
                                        id="add-region" value={selectedCode}
                                        onChange={(e) => setSelectedCode(e.target.value)}
                                        className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                                    >
                                        <option value="">選択してください</option>
                                        {regions.map(r => (
                                            <option key={r.code} value={r.code}>{r.name_local}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <Button type="button" onClick={handleAddArea} disabled={!selectedCode}
                                className="w-full bg-blue-600 hover:bg-blue-700">
                                ＋ 活動地域を追加
                            </Button>
                        </CardContent>
                    </Card>

                    {serviceAreas.length > 0 && (
                        <div className="space-y-2">
                            <Label>活動地域（{serviceAreas.length}件）</Label>
                            <div className="space-y-2">
                                {serviceAreas.map((area, index) => (
                                    <div key={index}
                                        className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                                        <span className="text-sm">{area.name_local || area.region_code}</span>
                                        <button type="button" onClick={() => handleRemoveArea(index)}
                                            className="text-red-500 hover:text-red-700 text-sm">削除</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
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