// 自由記述の緊急語彙による緊急度判定。相談フォーム(クライアント)と案件登録 API(サーバー)の両方で使う。
// 機械翻訳だけで確定せず、ネイティブ/専門家確認が必要な暫定リスト。

const URGENT_PHRASES = [
  '死にたい', '自殺', '殺される', '消えたい', '限界', '助けて', '虐待', '暴力', '人身取引', '監禁', '戦争', '紛争',
  '想死', '不想活', '自杀', '自殺', '救命', '虐待', '暴力', '家暴', '人口贩卖', '人口販賣',
  '죽고 싶', '죽고싶', '자살', '도와주세요', '살려주', '학대', '폭력', '가정폭력', '인신매매', '전쟁',
  'want to die', 'kill myself', 'end my life', 'commit suicide', 'attempt suicide', 'suicidal thoughts',
  'suicide', 'suicidal', 'abuse', 'abused', 'violence', 'trafficked', 'trafficking',
  'muốn chết', 'muon chet', 'tự tử', 'muon tu tu', 'cứu tôi', 'cuu toi', 'bạo lực', 'bao luc', 'bạo hành', 'bao hanh', 'buôn người', 'buon nguoi', 'chiến tranh', 'chien tranh',
  'bunuh diri', 'ingin mati', 'mau mati', 'ingin bunuh diri', 'tolong saya', 'kekerasan', 'perdagangan orang', 'kdrt', 'penganiayaan', 'diculik',
];

export function detectUrgency(text: string): boolean {
  const normalizedText = text.toLowerCase();
  return URGENT_PHRASES.some(phrase => normalizedText.includes(phrase.toLowerCase()));
}
