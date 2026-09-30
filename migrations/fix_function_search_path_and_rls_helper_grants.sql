-- Supabase Security Advisor の警告対応(2026-09-30)
--   1) function_search_path_mutable: 関数の search_path を public に固定する(動作は変わらない)
--   2) anon/authenticated_security_definer_function_executable:
--      イベントトリガー用の SECURITY DEFINER 関数 rls_auto_enable() を REST(/rpc)から呼べないようにする
--
-- 影響: なし(関数本体・トリガーの動きは同じ)。rollback は ALTER FUNCTION ... RESET search_path と GRANT EXECUTE。
-- 適用順: Staging → 動作確認 → 本番(ユーザー実行)。
-- Staging だけにある関数(update_news_posts_updated_at)は存在チェック付きなので、本番でも同じ SQL をそのまま流せる。

BEGIN;

-- 1) search_path の固定 -----------------------------------------------------
DO $$
DECLARE
    fn text;
    fns text[] := ARRAY[
        'public.accept_sos_offer(uuid, uuid, integer)',
        'public.generate_case_display_id()',
        'public.generate_display_id(text)',
        'public.generate_organization_display_id()',
        'public.prevent_last_active_organization_owner_removal()',
        'public.prevent_mixed_supporter_service_areas()',
        'public.prevent_nonempty_organization_deletion()',
        'public.set_inquiry_display_id()',
        'public.update_case_internal_notes_updated_at()',
        'public.update_organization_invitations_updated_at()',
        'public.update_organization_memberships_updated_at()',
        'public.update_organizations_updated_at()',
        'public.update_news_posts_updated_at()'   -- Staging のみ(お知らせ欄)。無ければ飛ばす
    ];
BEGIN
    FOREACH fn IN ARRAY fns LOOP
        IF to_regprocedure(fn) IS NOT NULL THEN
            EXECUTE format('ALTER FUNCTION %s SET search_path = public', fn);
        ELSE
            RAISE NOTICE 'skip (not found): %', fn;
        END IF;
    END LOOP;
END $$;

-- 2) rls_auto_enable() の実行権限 --------------------------------------------
-- ensure_rls イベントトリガーは所有者(postgres)権限で呼ぶので、外部ロールの EXECUTE は不要
DO $$
BEGIN
    IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
        REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
    ELSE
        RAISE NOTICE 'skip (not found): public.rls_auto_enable()';
    END IF;
END $$;

COMMIT;

-- 確認用(適用後に流す。proconfig が {search_path=public}、rls_auto_enable の proacl に anon/authenticated が無いこと)
-- select p.proname, p.proconfig, p.proacl::text
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' order by p.proname;
