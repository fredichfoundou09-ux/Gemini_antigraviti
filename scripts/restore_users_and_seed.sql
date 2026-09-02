-- ===============================================================
-- Restauration du Super Admin et des données de base dans Supabase
-- ===============================================================

DO $$
DECLARE
  v_user_id uuid := '681f86b4-862f-423a-b238-0d571e987bf6';
BEGIN
  -- 1. Compte Super Admin fredich
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'fredichfoundou09@gmail.com') THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      'fredichfoundou09@gmail.com',
      crypt('Sentinelle066328874//', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"FOUNDOU","username":"fredich","role":"superadmin"}',
      now(),
      now()
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = crypt('Sentinelle066328874//', gen_salt('bf')),
        email_confirmed_at = now(),
        updated_at = now()
    WHERE email = 'fredichfoundou09@gmail.com';
  END IF;

  -- 1b. Identité Supabase Auth (email est généré automatiquement par PostgreSQL)
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_user_id,
    'fredichfoundou09@gmail.com',
    jsonb_build_object('sub', v_user_id::text, 'email', 'fredichfoundou09@gmail.com', 'email_verified', true),
    'email',
    now(),
    now(),
    now()
  )
  ON CONFLICT (provider, provider_id) DO UPDATE SET
    identity_data = jsonb_build_object('sub', v_user_id::text, 'email', 'fredichfoundou09@gmail.com', 'email_verified', true),
    updated_at = now();

  -- 2. Profil Super Admin
  INSERT INTO public.profiles (id, username, name, email, role, active, created_at, updated_at)
  VALUES (
    v_user_id,
    'fredich',
    'FOUNDOU',
    'fredichfoundou09@gmail.com',
    'superadmin',
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    username = 'fredich',
    name = 'FOUNDOU',
    email = 'fredichfoundou09@gmail.com',
    role = 'superadmin',
    active = true,
    updated_at = now();

  -- 3. Inscription dans user_presence
  INSERT INTO public.user_presence (user_id, role, name, email, last_seen_at, is_online, updated_at)
  VALUES (
    v_user_id,
    'superadmin',
    'FOUNDOU',
    'fredichfoundou09@gmail.com',
    now(),
    true,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    is_online = true,
    last_seen_at = now(),
    updated_at = now();
END $$;
