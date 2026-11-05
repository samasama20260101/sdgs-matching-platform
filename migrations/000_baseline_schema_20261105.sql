-- ============================================================================
-- 000_baseline_schema_20261105.sql
-- 目的: v1(2026-11-05 時点)の public スキーマの全体。古い作成 SQL(users・cases・offers・messages など)が
--       リポジトリになかったので、Staging から書き起こした(v2.0 #72 の段階0)。
-- 作り方: Supabase CLI 3.0.0 の `db dump --remote=fzawgdmqewmwdqjsqjwt --schema public --dry-run` が出す
--         pg_dump の手順を、手元の pg_dump 17.9 で流した(スキーマだけ。データは含まない)。
-- 実行場所: 新しく作る空の環境だけ。今の Staging・本番には流さない(すでにこの形になっている)。
--           HANDOFF.md(2026-10-26)で Staging と本番のスキーマが一致していることを確かめてある。
--           本番の切り替えの前に、本番でも同じ形かを読み取りだけの確認で確かめ直す。
-- 影響: なし(記録用)。このあとの migrations/v2_*.sql は、この形の上に積む。
-- 戻し方: なし。
-- ============================================================================




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."accept_sos_offer"("p_offer_id" "uuid", "p_sos_user_id" "uuid", "p_max_accepted" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    target_offer offers%ROWTYPE;
    target_case cases%ROWTYPE;
    accepted_count integer;
    next_order integer;
BEGIN
    SELECT * INTO target_offer FROM offers WHERE id = p_offer_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'OFFER_NOT_FOUND');
    END IF;

    SELECT * INTO target_case FROM cases WHERE id = target_offer.case_id FOR UPDATE;
    IF NOT FOUND OR target_case.owner_user_id <> p_sos_user_id THEN
        RETURN jsonb_build_object('error', 'FORBIDDEN');
    END IF;

    IF target_offer.status <> 'PENDING' THEN
        RETURN jsonb_build_object('error', 'OFFER_NOT_PENDING');
    END IF;

    SELECT count(*)
    INTO accepted_count
    FROM offers
    WHERE case_id = target_offer.case_id
      AND status = 'ACCEPTED';

    IF accepted_count >= p_max_accepted THEN
        RETURN jsonb_build_object('error', 'MAX_REACHED');
    END IF;

    SELECT COALESCE(max(accepted_order), 0) + 1
    INTO next_order
    FROM offers
    WHERE case_id = target_offer.case_id;

    UPDATE offers
    SET status = 'ACCEPTED',
        accepted_order = next_order,
        accepted_at = now(),
        accepted_by_user_id = p_sos_user_id
    WHERE id = p_offer_id
      AND status = 'PENDING';

    UPDATE cases
    SET status = 'MATCHED'
    WHERE id = target_offer.case_id
      AND status = 'OPEN';

    IF accepted_count + 1 >= p_max_accepted THEN
        UPDATE offers
        SET status = 'DECLINED',
            declined_at = now(),
            declined_by_user_id = p_sos_user_id
        WHERE case_id = target_offer.case_id
          AND id <> p_offer_id
          AND status = 'PENDING';
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'accepted_order', next_order,
        'auto_declined', accepted_count + 1 >= p_max_accepted
    );
END;
$$;


ALTER FUNCTION "public"."accept_sos_offer"("p_offer_id" "uuid", "p_sos_user_id" "uuid", "p_max_accepted" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_case_display_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF NEW.display_id IS NULL OR NEW.display_id = '' THEN
        NEW.display_id := 'CASE-' || LPAD(nextval('cases_display_seq')::text, 5, '0');
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_case_display_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_display_id"("p_role" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    CASE p_role
        WHEN 'SOS' THEN
            RETURN 'SOS-' || LPAD(nextval('users_sos_display_seq')::text, 5, '0');
        WHEN 'SUPPORTER' THEN
            RETURN 'SUP-' || LPAD(nextval('users_sup_display_seq')::text, 5, '0');
        WHEN 'ADMIN' THEN
            RETURN 'ADM-' || LPAD(nextval('users_admin_display_seq')::text, 5, '0');
        ELSE
            RAISE EXCEPTION 'unsupported display id role: %', p_role;
    END CASE;
END;
$$;


ALTER FUNCTION "public"."generate_display_id"("p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_organization_display_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF NEW.display_id IS NULL OR NEW.display_id = '' THEN
        NEW.display_id := 'ORG-' || LPAD(nextval('organizations_display_seq')::text, 5, '0');
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_organization_display_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_last_active_organization_owner_removal"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF OLD.role = 'OWNER'
       AND OLD.status = 'ACTIVE'
       AND (
           TG_OP = 'DELETE'
           OR (
               TG_OP = 'UPDATE'
               AND (NEW.role <> 'OWNER' OR NEW.status <> 'ACTIVE')
           )
       )
    THEN
        PERFORM pg_advisory_xact_lock(hashtextextended(OLD.organization_id::text, 0));

        IF NOT EXISTS (
            SELECT 1
            FROM organization_memberships om
            WHERE om.organization_id = OLD.organization_id
              AND om.id <> OLD.id
              AND om.role = 'OWNER'
              AND om.status = 'ACTIVE'
        ) THEN
            RAISE EXCEPTION 'organization must retain at least one active OWNER';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_last_active_organization_owner_removal"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_mixed_supporter_service_areas"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM supporter_service_areas ssa
        WHERE ssa.organization_id = NEW.organization_id
          AND ssa.country = NEW.country
          AND ssa.is_nationwide <> NEW.is_nationwide
          AND (NEW.id IS NULL OR ssa.id <> NEW.id)
    ) THEN
        RAISE EXCEPTION 'nationwide and regional service areas cannot coexist for the same organization and country';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_mixed_supporter_service_areas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_nonempty_organization_deletion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM organization_memberships WHERE organization_id = OLD.id)
       OR EXISTS (SELECT 1 FROM organization_invitations WHERE organization_id = OLD.id)
       OR EXISTS (SELECT 1 FROM supporter_service_areas WHERE organization_id = OLD.id)
       OR EXISTS (SELECT 1 FROM offers WHERE supporter_organization_id = OLD.id)
       OR EXISTS (SELECT 1 FROM supporter_badges WHERE supporter_organization_id = OLD.id)
       OR EXISTS (SELECT 1 FROM messages WHERE sender_organization_id = OLD.id)
       OR EXISTS (SELECT 1 FROM audit_logs WHERE organization_id = OLD.id)
       OR EXISTS (SELECT 1 FROM case_internal_notes WHERE organization_id = OLD.id)
    THEN
        RAISE EXCEPTION 'organization has related history; set status to ARCHIVED instead of deleting';
    END IF;

    RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."prevent_nonempty_organization_deletion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_inquiry_display_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.display_id := 'INQ-' || LPAD(nextval('inquiries_seq')::text, 5, '0');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_inquiry_display_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_case_internal_notes_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_case_internal_notes_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_news_posts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_news_posts_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_organization_invitations_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_organization_invitations_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_organization_memberships_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    IF NEW.status = 'ACTIVE' AND NEW.joined_at IS NULL THEN
        NEW.joined_at = now();
    END IF;
    IF NEW.status = 'LEFT' AND NEW.left_at IS NULL THEN
        NEW.left_at = now();
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_organization_memberships_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_organizations_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_organizations_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid",
    "organization_id" "uuid",
    "action" "text" NOT NULL,
    "target_table" "text",
    "target_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."case_internal_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "organization_id" "uuid",
    "author_user_id" "uuid",
    "updated_by_user_id" "uuid",
    "deleted_by_user_id" "uuid",
    "visibility" "text" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "case_internal_notes_body_check" CHECK (("char_length"(TRIM(BOTH FROM "body")) > 0)),
    CONSTRAINT "case_internal_notes_check" CHECK ((("visibility" = 'ADMIN_ONLY'::"text") OR ("organization_id" IS NOT NULL))),
    CONSTRAINT "case_internal_notes_visibility_check" CHECK (("visibility" = ANY (ARRAY['ORGANIZATION_ONLY'::"text", 'APPROVED_SUPPORTERS'::"text", 'ADMIN_ONLY'::"text"])))
);


ALTER TABLE "public"."case_internal_notes" OWNER TO "postgres";


COMMENT ON TABLE "public"."case_internal_notes" IS 'SOSには表示しない案件内部メモ。承認済みサポーター間共有、自団体内メモ、運営メモを保持する。';



COMMENT ON COLUMN "public"."case_internal_notes"."visibility" IS 'ORGANIZATION_ONLY=自団体内, APPROVED_SUPPORTERS=承認済みサポーター間共有, ADMIN_ONLY=運営のみ';



CREATE TABLE IF NOT EXISTS "public"."cases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description_free" "text" NOT NULL,
    "urgency" "text" DEFAULT 'Medium'::"text",
    "status" "text" DEFAULT 'OPEN'::"text",
    "visibility" "text" DEFAULT 'UNLISTED'::"text",
    "intake_qna" "jsonb",
    "ai_sdg_suggestion" "jsonb",
    "region_country" "text" DEFAULT 'JP'::"text",
    "region_area" "text",
    "messages_expire_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "started_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "supporter_resolved_at" timestamp with time zone,
    "display_id" "text" NOT NULL,
    "locale" "text" DEFAULT 'ja'::"text" NOT NULL,
    CONSTRAINT "cases_locale_check" CHECK (("locale" = ANY (ARRAY['ja'::"text", 'en'::"text", 'zh'::"text", 'ko'::"text", 'vi'::"text", 'id'::"text"]))),
    CONSTRAINT "cases_status_allowed" CHECK (("status" = ANY (ARRAY['OPEN'::"text", 'MATCHED'::"text", 'RESOLVED'::"text", 'CLOSED'::"text", 'CANCELLED'::"text"])))
);


ALTER TABLE "public"."cases" OWNER TO "postgres";


COMMENT ON COLUMN "public"."cases"."locale" IS 'Locale snapshot for the SOS user at case creation time.';



CREATE SEQUENCE IF NOT EXISTS "public"."cases_display_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cases_display_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_disclosures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid",
    "offer_id" "uuid",
    "disclosed_to_user_id" "uuid",
    "disclosed_fields" "text"[],
    "disclosed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."contact_disclosures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."display_id_backup_20260816" (
    "id" "uuid",
    "role" "text",
    "display_id" "text",
    "created_at" timestamp with time zone
);


ALTER TABLE "public"."display_id_backup_20260816" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inquiries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "display_id" "text" DEFAULT ''::"text" NOT NULL,
    "user_id" "uuid",
    "role" "text",
    "name" "text",
    "email" "text" NOT NULL,
    "organization" "text",
    "phone" "text",
    "category" "text" NOT NULL,
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'OPEN'::"text" NOT NULL,
    "admin_memo" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."inquiries" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."inquiries_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."inquiries_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "sender_user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sender_organization_id" "uuid",
    "sender_display_name_snapshot" "text",
    "sender_role_snapshot" "text",
    "sender_organization_name_snapshot" "text",
    "message_type" "text" DEFAULT 'USER'::"text" NOT NULL,
    CONSTRAINT "messages_message_type_allowed" CHECK (("message_type" = ANY (ARRAY['USER'::"text", 'SYSTEM'::"text"])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."news_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" DEFAULT ''::"text" NOT NULL,
    "external_url" "text",
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "published_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "news_posts_category_check" CHECK (("category" = ANY (ARRAY['NOTICE'::"text", 'MAINTENANCE'::"text", 'SUPPORTER_JOINED'::"text", 'INTERVIEW'::"text", 'TOPIC'::"text"]))),
    CONSTRAINT "news_posts_status_check" CHECK (("status" = ANY (ARRAY['DRAFT'::"text", 'PUBLISHED'::"text"])))
);


ALTER TABLE "public"."news_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "supporter_user_id" "uuid" NOT NULL,
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text",
    "accepted_at" timestamp with time zone,
    "declined_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "accepted_order" integer,
    "supporter_organization_id" "uuid" NOT NULL,
    "created_by_user_id" "uuid",
    "accepted_by_user_id" "uuid",
    "declined_by_user_id" "uuid",
    "withdrawal_reason" "text",
    "withdrawn_at" timestamp with time zone,
    "withdrawn_by_user_id" "uuid",
    CONSTRAINT "offers_status_allowed" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'ACCEPTED'::"text", 'DECLINED'::"text", 'WITHDRAWN'::"text"]))),
    CONSTRAINT "offers_supporter_organization_required" CHECK (("supporter_organization_id" IS NOT NULL))
);


ALTER TABLE "public"."offers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'MEMBER'::"text" NOT NULL,
    "token_hash" "text",
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "invited_by_user_id" "uuid",
    "accepted_by_user_id" "uuid",
    "expires_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organization_invitations_role_check" CHECK (("role" = ANY (ARRAY['ADMIN'::"text", 'MEMBER'::"text"]))),
    CONSTRAINT "organization_invitations_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'ACCEPTED'::"text", 'CANCELLED'::"text", 'EXPIRED'::"text"])))
);


ALTER TABLE "public"."organization_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'MEMBER'::"text" NOT NULL,
    "status" "text" DEFAULT 'ACTIVE'::"text" NOT NULL,
    "invited_by_user_id" "uuid",
    "joined_at" timestamp with time zone,
    "left_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "department" "text",
    "external_phone" "text",
    "phone_extension" "text",
    "admin_note" "text",
    CONSTRAINT "organization_memberships_role_check" CHECK (("role" = ANY (ARRAY['OWNER'::"text", 'ADMIN'::"text", 'MEMBER'::"text"]))),
    CONSTRAINT "organization_memberships_status_check" CHECK (("status" = ANY (ARRAY['INVITED'::"text", 'ACTIVE'::"text", 'SUSPENDED'::"text", 'LEFT'::"text"])))
);


ALTER TABLE "public"."organization_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "supporter_type" "text",
    "bio" "text",
    "public_email" "text",
    "phone" "text",
    "postal_code" "text",
    "prefecture" "text",
    "city" "text",
    "address_structured" "jsonb",
    "social_links" "jsonb",
    "reception_status" "text" DEFAULT 'CONSULT'::"text" NOT NULL,
    "status" "text" DEFAULT 'ACTIVE'::"text" NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "featured_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "display_id" "text" NOT NULL,
    "slug" "text",
    CONSTRAINT "organizations_reception_status_check" CHECK (("reception_status" = ANY (ARRAY['ACCEPTING'::"text", 'CONSULT'::"text", 'UNAVAILABLE'::"text"]))),
    CONSTRAINT "organizations_slug_shape" CHECK ((("slug" IS NULL) OR ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::"text"))),
    CONSTRAINT "organizations_status_check" CHECK (("status" = ANY (ARRAY['ACTIVE'::"text", 'PAUSED'::"text", 'ARCHIVED'::"text"])))
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."organizations_display_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."organizations_display_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ratings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid",
    "rater_user_id" "uuid",
    "ratee_user_id" "uuid",
    "score" integer,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ratings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."regions" (
    "code" "text" NOT NULL,
    "country" character(2) NOT NULL,
    "level" "text" NOT NULL,
    "name_local" "text" NOT NULL,
    "name_en" "text" NOT NULL,
    "parent_code" "text",
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."regions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supporter_badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "supporter_user_id" "uuid" NOT NULL,
    "given_by_user_id" "uuid" NOT NULL,
    "badge_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "supporter_organization_id" "uuid" NOT NULL,
    CONSTRAINT "supporter_badges_organization_required" CHECK (("supporter_organization_id" IS NOT NULL))
);


ALTER TABLE "public"."supporter_badges" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."supporter_service_areas_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."supporter_service_areas_id_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supporter_service_areas" (
    "id" bigint DEFAULT "nextval"('"public"."supporter_service_areas_id_seq"'::"regclass") NOT NULL,
    "supporter_user_id" "uuid" NOT NULL,
    "region_code" "text",
    "is_nationwide" boolean DEFAULT false NOT NULL,
    "country" character(2) DEFAULT 'JP'::"bpchar" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    CONSTRAINT "supporter_service_areas_organization_required" CHECK (("organization_id" IS NOT NULL)),
    CONSTRAINT "supporter_service_areas_region_shape" CHECK (((("is_nationwide" = true) AND ("region_code" IS NULL)) OR (("is_nationwide" = false) AND ("region_code" IS NOT NULL))))
);


ALTER TABLE "public"."supporter_service_areas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "supporter_type" "text",
    "real_name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "organization_name" "text",
    "region_country" "text" DEFAULT 'JP'::"text",
    "postal_code" "text",
    "prefecture" "text",
    "city" "text",
    "address_structured" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "must_change_password" boolean DEFAULT false NOT NULL,
    "bio" "text",
    "social_links" "jsonb",
    "sos_region_code" "text",
    "is_featured" boolean DEFAULT false NOT NULL,
    "featured_order" integer DEFAULT 0 NOT NULL,
    "gender" "text",
    "birth_date" "date",
    "display_id" "text",
    "is_suspended" boolean DEFAULT false,
    "parent_supporter_id" "uuid",
    "member_approved_at" timestamp with time zone,
    "is_legacy_supporter" boolean DEFAULT false NOT NULL,
    "locale" "text" DEFAULT 'ja'::"text" NOT NULL,
    CONSTRAINT "users_locale_check" CHECK (("locale" = ANY (ARRAY['ja'::"text", 'en'::"text", 'zh'::"text", 'ko'::"text", 'vi'::"text", 'id'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."locale" IS 'Preferred UI locale for the app.';



CREATE SEQUENCE IF NOT EXISTS "public"."users_admin_display_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."users_admin_display_seq" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."users_sos_display_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."users_sos_display_seq" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."users_sup_display_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."users_sup_display_seq" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."case_internal_notes"
    ADD CONSTRAINT "case_internal_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cases"
    ADD CONSTRAINT "cases_display_id_unique" UNIQUE ("display_id");



ALTER TABLE ONLY "public"."cases"
    ADD CONSTRAINT "cases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_disclosures"
    ADD CONSTRAINT "contact_disclosures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inquiries"
    ADD CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."news_posts"
    ADD CONSTRAINT "news_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_display_id_unique" UNIQUE ("display_id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."regions"
    ADD CONSTRAINT "regions_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."supporter_badges"
    ADD CONSTRAINT "supporter_badges_organization_unique" UNIQUE ("case_id", "supporter_organization_id", "badge_key");



ALTER TABLE ONLY "public"."supporter_badges"
    ADD CONSTRAINT "supporter_badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supporter_badges"
    ADD CONSTRAINT "supporter_badges_unique" UNIQUE ("case_id", "supporter_user_id", "badge_key");



ALTER TABLE ONLY "public"."supporter_service_areas"
    ADD CONSTRAINT "supporter_service_areas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_audit_logs_actor_created" ON "public"."audit_logs" USING "btree" ("actor_user_id", "created_at" DESC);



CREATE INDEX "idx_audit_logs_organization_created" ON "public"."audit_logs" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_case_internal_notes_author_created" ON "public"."case_internal_notes" USING "btree" ("author_user_id", "created_at" DESC);



CREATE INDEX "idx_case_internal_notes_case_visibility_active" ON "public"."case_internal_notes" USING "btree" ("case_id", "visibility", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_case_internal_notes_organization_case_active" ON "public"."case_internal_notes" USING "btree" ("organization_id", "case_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_messages_sender_organization_id" ON "public"."messages" USING "btree" ("sender_organization_id");



CREATE INDEX "idx_news_posts_published" ON "public"."news_posts" USING "btree" ("published_at" DESC) WHERE ("status" = 'PUBLISHED'::"text");



CREATE INDEX "idx_offers_case_accepted" ON "public"."offers" USING "btree" ("case_id", "accepted_order") WHERE ("status" = 'ACCEPTED'::"text");



CREATE UNIQUE INDEX "idx_offers_case_accepted_order_unique" ON "public"."offers" USING "btree" ("case_id", "accepted_order") WHERE (("status" = 'ACCEPTED'::"text") AND ("accepted_order" IS NOT NULL));



CREATE UNIQUE INDEX "idx_offers_case_organization_unique" ON "public"."offers" USING "btree" ("case_id", "supporter_organization_id") WHERE ("supporter_organization_id" IS NOT NULL);



CREATE INDEX "idx_offers_created_by_user_id" ON "public"."offers" USING "btree" ("created_by_user_id");



CREATE INDEX "idx_offers_supporter_organization_id" ON "public"."offers" USING "btree" ("supporter_organization_id");



CREATE UNIQUE INDEX "idx_organization_invitations_pending_email" ON "public"."organization_invitations" USING "btree" ("organization_id", "lower"("email")) WHERE ("status" = 'PENDING'::"text");



CREATE UNIQUE INDEX "idx_organization_memberships_current_unique" ON "public"."organization_memberships" USING "btree" ("organization_id", "user_id") WHERE ("status" = ANY (ARRAY['INVITED'::"text", 'ACTIVE'::"text", 'SUSPENDED'::"text"]));



CREATE INDEX "idx_organization_memberships_org_status" ON "public"."organization_memberships" USING "btree" ("organization_id", "status");



CREATE UNIQUE INDEX "idx_organization_memberships_user_current_unique" ON "public"."organization_memberships" USING "btree" ("user_id") WHERE ("status" = ANY (ARRAY['ACTIVE'::"text", 'SUSPENDED'::"text"]));



CREATE INDEX "idx_organization_memberships_user_status" ON "public"."organization_memberships" USING "btree" ("user_id", "status");



CREATE INDEX "idx_organizations_featured" ON "public"."organizations" USING "btree" ("is_featured", "featured_order") WHERE ("is_featured" = true);



CREATE UNIQUE INDEX "idx_organizations_slug_unique" ON "public"."organizations" USING "btree" ("lower"("slug")) WHERE ("slug" IS NOT NULL);



CREATE INDEX "idx_organizations_status" ON "public"."organizations" USING "btree" ("status", "reception_status");



CREATE INDEX "idx_supporter_badges_supporter_organization_id" ON "public"."supporter_badges" USING "btree" ("supporter_organization_id");



CREATE UNIQUE INDEX "idx_supporter_service_areas_nationwide_unique" ON "public"."supporter_service_areas" USING "btree" ("organization_id", "country") WHERE ("is_nationwide" = true);



CREATE INDEX "idx_supporter_service_areas_organization_id" ON "public"."supporter_service_areas" USING "btree" ("organization_id");



CREATE UNIQUE INDEX "idx_supporter_service_areas_region_unique" ON "public"."supporter_service_areas" USING "btree" ("organization_id", "country", "region_code") WHERE ("is_nationwide" = false);



CREATE UNIQUE INDEX "idx_users_display_id_unique" ON "public"."users" USING "btree" ("display_id") WHERE ("display_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_users_email_normalized_unique" ON "public"."users" USING "btree" ("lower"("btrim"("email"))) WHERE ("email" IS NOT NULL);



CREATE OR REPLACE TRIGGER "prevent_last_active_organization_owner_removal" BEFORE DELETE OR UPDATE ON "public"."organization_memberships" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_last_active_organization_owner_removal"();



CREATE OR REPLACE TRIGGER "prevent_mixed_supporter_service_areas" BEFORE INSERT OR UPDATE ON "public"."supporter_service_areas" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_mixed_supporter_service_areas"();



CREATE OR REPLACE TRIGGER "prevent_nonempty_organization_deletion" BEFORE DELETE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_nonempty_organization_deletion"();



CREATE OR REPLACE TRIGGER "set_case_display_id" BEFORE INSERT ON "public"."cases" FOR EACH ROW EXECUTE FUNCTION "public"."generate_case_display_id"();



CREATE OR REPLACE TRIGGER "set_case_internal_notes_updated_at" BEFORE UPDATE ON "public"."case_internal_notes" FOR EACH ROW EXECUTE FUNCTION "public"."update_case_internal_notes_updated_at"();



CREATE OR REPLACE TRIGGER "set_news_posts_updated_at" BEFORE UPDATE ON "public"."news_posts" FOR EACH ROW EXECUTE FUNCTION "public"."update_news_posts_updated_at"();



CREATE OR REPLACE TRIGGER "set_organization_display_id" BEFORE INSERT ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."generate_organization_display_id"();



CREATE OR REPLACE TRIGGER "set_organization_invitations_updated_at" BEFORE UPDATE ON "public"."organization_invitations" FOR EACH ROW EXECUTE FUNCTION "public"."update_organization_invitations_updated_at"();



CREATE OR REPLACE TRIGGER "set_organization_memberships_updated_at" BEFORE INSERT OR UPDATE ON "public"."organization_memberships" FOR EACH ROW EXECUTE FUNCTION "public"."update_organization_memberships_updated_at"();



CREATE OR REPLACE TRIGGER "set_organizations_updated_at" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."update_organizations_updated_at"();



CREATE OR REPLACE TRIGGER "trg_set_inquiry_display_id" BEFORE INSERT ON "public"."inquiries" FOR EACH ROW EXECUTE FUNCTION "public"."set_inquiry_display_id"();



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."case_internal_notes"
    ADD CONSTRAINT "case_internal_notes_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."case_internal_notes"
    ADD CONSTRAINT "case_internal_notes_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."case_internal_notes"
    ADD CONSTRAINT "case_internal_notes_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."case_internal_notes"
    ADD CONSTRAINT "case_internal_notes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."case_internal_notes"
    ADD CONSTRAINT "case_internal_notes_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cases"
    ADD CONSTRAINT "cases_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."contact_disclosures"
    ADD CONSTRAINT "contact_disclosures_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id");



ALTER TABLE ONLY "public"."contact_disclosures"
    ADD CONSTRAINT "contact_disclosures_disclosed_to_user_id_fkey" FOREIGN KEY ("disclosed_to_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."contact_disclosures"
    ADD CONSTRAINT "contact_disclosures_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id");



ALTER TABLE ONLY "public"."inquiries"
    ADD CONSTRAINT "inquiries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_organization_id_fkey" FOREIGN KEY ("sender_organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."news_posts"
    ADD CONSTRAINT "news_posts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_accepted_by_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id");



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_declined_by_user_id_fkey" FOREIGN KEY ("declined_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_supporter_organization_id_fkey" FOREIGN KEY ("supporter_organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_supporter_user_id_fkey" FOREIGN KEY ("supporter_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_withdrawn_by_user_id_fkey" FOREIGN KEY ("withdrawn_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_accepted_by_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id");



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_ratee_user_id_fkey" FOREIGN KEY ("ratee_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_rater_user_id_fkey" FOREIGN KEY ("rater_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."supporter_badges"
    ADD CONSTRAINT "supporter_badges_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id");



ALTER TABLE ONLY "public"."supporter_badges"
    ADD CONSTRAINT "supporter_badges_given_by_user_id_fkey" FOREIGN KEY ("given_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."supporter_badges"
    ADD CONSTRAINT "supporter_badges_supporter_organization_id_fkey" FOREIGN KEY ("supporter_organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supporter_badges"
    ADD CONSTRAINT "supporter_badges_supporter_user_id_fkey" FOREIGN KEY ("supporter_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."supporter_service_areas"
    ADD CONSTRAINT "supporter_service_areas_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supporter_service_areas"
    ADD CONSTRAINT "supporter_service_areas_supporter_user_id_fkey" FOREIGN KEY ("supporter_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_parent_supporter_id_fkey" FOREIGN KEY ("parent_supporter_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."case_internal_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_disclosures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."display_id_backup_20260816" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inquiries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."news_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."offers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ratings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."regions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supporter_badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supporter_service_areas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."accept_sos_offer"("p_offer_id" "uuid", "p_sos_user_id" "uuid", "p_max_accepted" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_sos_offer"("p_offer_id" "uuid", "p_sos_user_id" "uuid", "p_max_accepted" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."accept_sos_offer"("p_offer_id" "uuid", "p_sos_user_id" "uuid", "p_max_accepted" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_sos_offer"("p_offer_id" "uuid", "p_sos_user_id" "uuid", "p_max_accepted" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_case_display_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_case_display_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_case_display_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."generate_display_id"("p_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_display_id"("p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_display_id"("p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_display_id"("p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_organization_display_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_organization_display_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_organization_display_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_last_active_organization_owner_removal"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_last_active_organization_owner_removal"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_last_active_organization_owner_removal"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_mixed_supporter_service_areas"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_mixed_supporter_service_areas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_mixed_supporter_service_areas"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_nonempty_organization_deletion"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_nonempty_organization_deletion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_nonempty_organization_deletion"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_inquiry_display_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_inquiry_display_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_inquiry_display_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_case_internal_notes_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_case_internal_notes_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_case_internal_notes_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_news_posts_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_news_posts_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_news_posts_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_organization_invitations_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_organization_invitations_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_organization_invitations_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_organization_memberships_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_organization_memberships_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_organization_memberships_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_organizations_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_organizations_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_organizations_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."case_internal_notes" TO "anon";
GRANT ALL ON TABLE "public"."case_internal_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."case_internal_notes" TO "service_role";



GRANT ALL ON TABLE "public"."cases" TO "anon";
GRANT ALL ON TABLE "public"."cases" TO "authenticated";
GRANT ALL ON TABLE "public"."cases" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cases_display_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cases_display_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cases_display_seq" TO "service_role";



GRANT ALL ON TABLE "public"."contact_disclosures" TO "anon";
GRANT ALL ON TABLE "public"."contact_disclosures" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_disclosures" TO "service_role";



GRANT ALL ON TABLE "public"."display_id_backup_20260816" TO "anon";
GRANT ALL ON TABLE "public"."display_id_backup_20260816" TO "authenticated";
GRANT ALL ON TABLE "public"."display_id_backup_20260816" TO "service_role";



GRANT ALL ON TABLE "public"."inquiries" TO "anon";
GRANT ALL ON TABLE "public"."inquiries" TO "authenticated";
GRANT ALL ON TABLE "public"."inquiries" TO "service_role";



GRANT ALL ON SEQUENCE "public"."inquiries_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."inquiries_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."inquiries_seq" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."news_posts" TO "anon";
GRANT ALL ON TABLE "public"."news_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."news_posts" TO "service_role";



GRANT ALL ON TABLE "public"."offers" TO "anon";
GRANT ALL ON TABLE "public"."offers" TO "authenticated";
GRANT ALL ON TABLE "public"."offers" TO "service_role";



GRANT ALL ON TABLE "public"."organization_invitations" TO "anon";
GRANT ALL ON TABLE "public"."organization_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."organization_memberships" TO "anon";
GRANT ALL ON TABLE "public"."organization_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."organizations_display_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."organizations_display_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."organizations_display_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ratings" TO "anon";
GRANT ALL ON TABLE "public"."ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."ratings" TO "service_role";



GRANT ALL ON TABLE "public"."regions" TO "anon";
GRANT ALL ON TABLE "public"."regions" TO "authenticated";
GRANT ALL ON TABLE "public"."regions" TO "service_role";



GRANT ALL ON TABLE "public"."supporter_badges" TO "anon";
GRANT ALL ON TABLE "public"."supporter_badges" TO "authenticated";
GRANT ALL ON TABLE "public"."supporter_badges" TO "service_role";



GRANT ALL ON SEQUENCE "public"."supporter_service_areas_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."supporter_service_areas_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."supporter_service_areas_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."supporter_service_areas" TO "anon";
GRANT ALL ON TABLE "public"."supporter_service_areas" TO "authenticated";
GRANT ALL ON TABLE "public"."supporter_service_areas" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON SEQUENCE "public"."users_admin_display_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."users_admin_display_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."users_admin_display_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."users_sos_display_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."users_sos_display_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."users_sos_display_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."users_sup_display_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."users_sup_display_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."users_sup_display_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







