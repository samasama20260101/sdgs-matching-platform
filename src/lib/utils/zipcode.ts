/**
 * 郵便番号から住所を自動取得するユーティリティ
 * 
 * 日本: zipcloud API（無料、登録不要）
 * インドネシア: 将来的に対応予定
 */

export type AddressData = {
    prefecture: string;      // 都道府県
    city: string;           // 市区町村
    town: string;           // 町域
    fullAddress: string;    // 都道府県+市区町村+町域
};

/**
 * 日本の郵便番号から住所を取得
 * @param zipcode - 郵便番号（ハイフンあり/なし両対応）
 * @returns 住所データまたはnull
 */
export async function fetchJapanAddressFromZipcode(
    zipcode: string
): Promise<AddressData | null> {
    try {
        // ハイフンを除去して7桁の数字のみに
        const cleanZipcode = zipcode.replace(/[^0-9]/g, '');

        // 7桁でない場合はエラー
        if (cleanZipcode.length !== 7) {
            console.warn('郵便番号は7桁である必要があります');
            return null;
        }

        // zipcloud API呼び出し
        const response = await fetch(
            `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${cleanZipcode}`
        );

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        // ステータスチェック
        if (data.status !== 200) {
            console.warn('郵便番号が見つかりませんでした');
            return null;
        }

        // 結果が存在するか
        if (!data.results || data.results.length === 0) {
            console.warn('該当する住所が見つかりませんでした');
            return null;
        }

        // 最初の結果を使用（複数ヒットする場合は最初のもの）
        const result = data.results[0];

        return {
            prefecture: result.address1,     // 都道府県
            city: result.address2,           // 市区町村
            town: result.address3,           // 町域
            fullAddress: `${result.address1}${result.address2}${result.address3}`,
        };

    } catch (error) {
        console.error('郵便番号検索エラー:', error);
        return null;
    }
}

/**
 * 郵便番号を整形（123-4567形式）
 * @param zipcode - 入力された郵便番号
 * @returns 整形された郵便番号（7桁の場合のみ）
 */
export function formatZipcode(zipcode: string): string {
    const clean = zipcode.replace(/[^0-9]/g, '');

    if (clean.length === 7) {
        return `${clean.slice(0, 3)}-${clean.slice(3)}`;
    }

    return clean;
}

/**
 * 郵便番号の妥当性チェック（日本）
 * @param zipcode - チェックする郵便番号
 * @returns 妥当な場合true
 */
export function isValidJapanZipcode(zipcode: string): boolean {
    const clean = zipcode.replace(/[^0-9]/g, '');
    return clean.length === 7;
}

/**
 * インドネシアの郵便番号から住所を取得（将来実装予定）
 * @param zipcode - 郵便番号（5桁）
 * @returns 住所データまたはnull
 */
export async function fetchIndonesiaAddressFromZipcode(
    zipcode: string
): Promise<AddressData | null> {
    // TODO: インドネシアの郵便番号APIを実装
    // 候補: https://kodepos.vercel.app/ など
    console.warn('インドネシアの郵便番号検索は未実装です');
    return null;
}

/**
 * 国コードに応じて適切な郵便番号検索を実行
 * @param zipcode - 郵便番号
 * @param countryCode - 国コード（'JP' | 'ID'）
 * @returns 住所データまたはnull
 */
export async function fetchAddressFromZipcode(
    zipcode: string,
    countryCode: 'JP' | 'ID' = 'JP'
): Promise<AddressData | null> {
    if (countryCode === 'JP') {
        return fetchJapanAddressFromZipcode(zipcode);
    } else if (countryCode === 'ID') {
        return fetchIndonesiaAddressFromZipcode(zipcode);
    }

    console.warn(`未対応の国コード: ${countryCode}`);
    return null;
}