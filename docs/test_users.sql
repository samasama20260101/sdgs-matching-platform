-- =====================================================
-- 明日もsamasama テストユーザー登録SQL（Staging用）
-- パスワード: testpass123
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  u UUID;
  pwd TEXT;
BEGIN
  pwd := crypt('testpass123', gen_salt('bf'));

  -- =====================
  -- SOS Users (20名)
  -- =====================

  -- SOS001 大谷翔平（男性・30歳）
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','SOS001@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,gender,birth_date,phone)
  VALUES(u,'SOS','大谷翔平','大谷翔平','SOS001@gmail.com','MALE','1994-07-05','09011110001');

  -- SOS002 錦織圭（男性・35歳）
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','SOS002@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,gender,birth_date,phone)
  VALUES(u,'SOS','錦織圭','錦織圭','SOS002@gmail.com','MALE','1989-12-29','09011110002');

  -- SOS003 羽生結弦（男性・30歳）
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','SOS003@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,gender,birth_date,phone)
  VALUES(u,'SOS','羽生結弦','羽生結弦','SOS003@gmail.com','MALE','1994-12-07','09011110003');

  -- SOS004 浅田真央（女性・34歳）
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','SOS004@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,gender,birth_date,phone)
  VALUES(u,'SOS','浅田真央','浅田真央','SOS004@gmail.com','FEMALE','1990-09-25','09011110004');

  -- SOS005 石川遼（男性・33歳）
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','SOS005@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,gender,birth_date,phone)
  VALUES(u,'SOS','石川遼','石川遼','SOS005@gmail.com','MALE','1991-09-17','09011110005');

  -- SOS006 北島康介（男性・41歳）
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','SOS006@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,gender,birth_date,phone)
  VALUES(u,'SOS','北島康介','北島康介','SOS006@gmail.com','MALE','1983-09-22','09011110006');

  -- SOS007 吉田沙保里（女性・42歳）
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','SOS007@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,gender,birth_date,phone)
  VALUES(u,'SOS','吉田沙保里','吉田沙保里','SOS007@gmail.com','FEMALE','1982-10-05','09011110007');

  -- SOS008 伊調馨（女性・40歳）
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','SOS008@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,gender,birth_date,phone)
  VALUES(u,'SOS','伊調馨','伊調馨','SOS008@gmail.com','FEMALE','1984-06-02','09011110008');

  -- SOS009 内村航平（男性・36歳）
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','SOS009@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,gender,birth_date,phone)
  VALUES(u,'SOS','内村航平','内村航平','SOS009@gmail.com','MALE','1989-01-03','09011110009');

  -- SOS010 野口みずき（女性・46歳）
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','SOS010@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,gender,birth_date,phone)
  VALUES(u,'SOS','野口みずき','野口みずき','SOS010@gmail.com','FEMALE','1978-07-03','09011110010');

  -- SOS011 福原愛（女性・36歳）
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','SOS011@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,gender,birth_date,phone)
  VALUES(u,'SOS','福原愛','福原愛','SOS011@gmail.com','FEMALE','1988-11-01','09011110011');

  -- SOS012 松山英樹（男性・32歳）
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','SOS012@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,gender,birth_date,phone)
  VALUES(u,'SOS','松山英樹','松山英樹','SOS012@gmail.com','MALE','1992-02-25','09011110012');

  -- SOS013 池江璃花子（女性・24歳）
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','SOS013@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,gender,birth_date,phone)
  VALUES(u,'SOS','池江璃花子','池江璃花子','SOS013@gmail.com','FEMALE','2000-07-04','09011110013');

  -- SOS014 宇野昌磨（男性・24歳）
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','SOS014@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,gender,birth_date,phone)
  VALUES(u,'SOS','宇野昌磨','宇野昌磨','SOS014@gmail.com','MALE','2000-12-17','09011110014');

  -- SOS015 高梨沙羅（女性・18歳 成年ギリギリ）
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','SOS015@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,gender,birth_date,phone)
  VALUES(u,'SOS','高梨沙羅','高梨沙羅','SOS015@gmail.com','FEMALE','2006-10-08','09011110015');

  -- SOS016 桃田賢斗（男性・30歳）
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','SOS016@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,gender,birth_date,phone)
  VALUES(u,'SOS','桃田賢斗','桃田賢斗','SOS016@gmail.com','MALE','1994-09-05','09011110016');

  -- SOS017 平野美宇（女性・24歳）
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','SOS017@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,gender,birth_date,phone)
  VALUES(u,'SOS','平野美宇','平野美宇','SOS017@gmail.com','FEMALE','2000-10-14','09011110017');

  -- SOS018 渡辺勇大（男性・15歳 🔰未成年）
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','SOS018@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,gender,birth_date,phone)
  VALUES(u,'SOS','渡辺勇大','渡辺勇大','SOS018@gmail.com','MALE','2009-06-13','09011110018');

  -- SOS019 木下あいら（女性・17歳 🔰未成年）
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','SOS019@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,gender,birth_date,phone)
  VALUES(u,'SOS','木下あいら','木下あいら','SOS019@gmail.com','FEMALE','2007-03-21','09011110019');

  -- SOS020 田中刑事（男性・28歳）
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','SOS020@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,gender,birth_date,phone)
  VALUES(u,'SOS','田中刑事','田中刑事','SOS020@gmail.com','MALE','1997-03-22','09011110020');

  -- =====================
  -- サポーター：行政（5名）
  -- must_change_password = false（初期PW変更不要）
  -- =====================

  -- GOV001 東京都
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','GOV001@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,organization_name,supporter_type,phone,must_change_password)
  VALUES(u,'SUPPORTER','東京都担当者','東京都','GOV001@gmail.com','東京都','GOVERNMENT','09022220001',false);

  -- GOV002 大阪府
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','GOV002@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,organization_name,supporter_type,phone,must_change_password)
  VALUES(u,'SUPPORTER','大阪府担当者','大阪府','GOV002@gmail.com','大阪府','GOVERNMENT','09022220002',false);

  -- GOV003 愛知県
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','GOV003@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,organization_name,supporter_type,phone,must_change_password)
  VALUES(u,'SUPPORTER','愛知県担当者','愛知県','GOV003@gmail.com','愛知県','GOVERNMENT','09022220003',false);

  -- GOV004 神奈川県
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','GOV004@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,organization_name,supporter_type,phone,must_change_password)
  VALUES(u,'SUPPORTER','神奈川県担当者','神奈川県','GOV004@gmail.com','神奈川県','GOVERNMENT','09022220004',false);

  -- GOV005 福岡県
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','GOV005@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,organization_name,supporter_type,phone,must_change_password)
  VALUES(u,'SUPPORTER','福岡県担当者','福岡県','GOV005@gmail.com','福岡県','GOVERNMENT','09022220005',false);

  -- =====================
  -- サポーター：NPO（5名・戦国武将）
  -- =====================

  -- NPO001 織田信長
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','NPO001@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,organization_name,supporter_type,phone,must_change_password)
  VALUES(u,'SUPPORTER','織田信長','織田信長NPO','NPO001@gmail.com','織田信長NPO','NPO','09033330001',false);

  -- NPO002 豊臣秀吉
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','NPO002@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,organization_name,supporter_type,phone,must_change_password)
  VALUES(u,'SUPPORTER','豊臣秀吉','豊臣秀吉NPO','NPO002@gmail.com','豊臣秀吉NPO','NPO','09033330002',false);

  -- NPO003 徳川家康
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','NPO003@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,organization_name,supporter_type,phone,must_change_password)
  VALUES(u,'SUPPORTER','徳川家康','徳川家康NPO','NPO003@gmail.com','徳川家康NPO','NPO','09033330003',false);

  -- NPO004 上杉謙信
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','NPO004@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,organization_name,supporter_type,phone,must_change_password)
  VALUES(u,'SUPPORTER','上杉謙信','上杉謙信NPO','NPO004@gmail.com','上杉謙信NPO','NPO','09033330004',false);

  -- NPO005 武田信玄
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','NPO005@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,organization_name,supporter_type,phone,must_change_password)
  VALUES(u,'SUPPORTER','武田信玄','武田信玄NPO','NPO005@gmail.com','武田信玄NPO','NPO','09033330005',false);

  -- =====================
  -- サポーター：企業（5名）
  -- =====================

  -- BIZ001 トヨタ自動車
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','BIZ001@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,organization_name,supporter_type,phone,must_change_password)
  VALUES(u,'SUPPORTER','トヨタ担当者','トヨタ自動車','BIZ001@gmail.com','トヨタ自動車株式会社','CORPORATE','09044440001',false);

  -- BIZ002 ソニーグループ
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','BIZ002@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,organization_name,supporter_type,phone,must_change_password)
  VALUES(u,'SUPPORTER','ソニー担当者','ソニーグループ','BIZ002@gmail.com','ソニーグループ株式会社','CORPORATE','09044440002',false);

  -- BIZ003 ソフトバンク
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','BIZ003@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,organization_name,supporter_type,phone,must_change_password)
  VALUES(u,'SUPPORTER','ソフトバンク担当者','ソフトバンク','BIZ003@gmail.com','ソフトバンク株式会社','CORPORATE','09044440003',false);

  -- BIZ004 パナソニック
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','BIZ004@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,organization_name,supporter_type,phone,must_change_password)
  VALUES(u,'SUPPORTER','パナソニック担当者','パナソニック','BIZ004@gmail.com','パナソニック株式会社','CORPORATE','09044440004',false);

  -- BIZ005 楽天グループ
  INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','BIZ005@gmail.com',pwd,NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{}',false)
  RETURNING id INTO u;
  INSERT INTO public.users(auth_user_id,role,real_name,display_name,email,organization_name,supporter_type,phone,must_change_password)
  VALUES(u,'SUPPORTER','楽天担当者','楽天グループ','BIZ005@gmail.com','楽天グループ株式会社','CORPORATE','09044440005',false);

END $$;
