-- ============================================================================
-- v2_07_supporter_skill_areas.sql(v2.0 #72)
-- 目的: 個人の支え手の得意なことを、17 のゴール(skill_categories)から「相談した人の種類 × ゴール」(skill_areas)に変える。
--   大項目の名前が相談した人の種類ごとに違うため(依頼者の指標一覧の列D〜F。11/5 に「種類ごとに分ける」と決めた)。
--   個人の支え手は会社と地域の相談だけを支えるので、値は "COMPANY:<ゴール>" か "COMMUNITY:<ゴール>"。
--   名前があるゴールは src/lib/constants/supportAreas.generated.ts(会社 1,2,3,5,6,8,9,10,11,12,13,14,15,16,17 /
--   地域 1,2,3,4,6,7,8,9,11,12,13,14,15,16,17)。どの組み合わせを受けるかは API(sanitizeSkillAreas)が決め、DB は形だけを見る。
-- 実行場所: Staging(v2_06 のあと)。本番は v2_01〜06 と一緒に流す。何度流しても同じ結果。
-- 影響: supporter_profiles に skill_areas を足し、skill_categories の値を写してから skill_categories を消す。
--   写し方: ゴール c を、その種類に名前がある分だけ COMPANY:c・COMMUNITY:c にする。
-- 戻し方:
--   ALTER TABLE supporter_profiles ADD COLUMN skill_categories smallint[] NOT NULL DEFAULT '{}';
--   UPDATE supporter_profiles SET skill_categories = (SELECT coalesce(array_agg(DISTINCT split_part(a, ':', 2)::smallint), '{}') FROM unnest(skill_areas) a);
--   ALTER TABLE supporter_profiles DROP COLUMN skill_areas;
-- ============================================================================

BEGIN;

ALTER TABLE supporter_profiles ADD COLUMN IF NOT EXISTS skill_areas text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supporter_profiles_skill_areas_format') THEN
    ALTER TABLE supporter_profiles ADD CONSTRAINT supporter_profiles_skill_areas_format CHECK (
      cardinality(skill_areas) = 0
      OR array_to_string(skill_areas, ',') ~ '^(COMPANY|COMMUNITY):[0-9]{1,2}(,(COMPANY|COMMUNITY):[0-9]{1,2})*$'
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'supporter_profiles' AND column_name = 'skill_categories'
  ) THEN
    UPDATE supporter_profiles p
    SET skill_areas = (
      SELECT coalesce(array_agg(x.k ORDER BY x.ord), '{}')
      FROM (
        SELECT 'COMPANY:' || c AS k, 100 + c AS ord
        FROM unnest(p.skill_categories) AS c
        WHERE c = ANY (ARRAY[1, 2, 3, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17])
        UNION ALL
        SELECT 'COMMUNITY:' || c, 200 + c
        FROM unnest(p.skill_categories) AS c
        WHERE c = ANY (ARRAY[1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17])
      ) AS x
    )
    WHERE cardinality(p.skill_areas) = 0 AND cardinality(p.skill_categories) > 0;

    ALTER TABLE supporter_profiles DROP COLUMN skill_categories;
  END IF;
END $$;

COMMIT;
