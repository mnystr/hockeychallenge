# Admin recovery

If both super-admin accounts are lost (or demoted), the app wedges — team
creation requests can't be approved. This doc is the escape hatch.

## Re-flag an existing user as super-admin

The `enforce_super_admin_minimum` trigger blocks *demotion* when fewer than
two super-admins would remain, but it does **not** block promotion. Run this
from the Supabase dashboard SQL editor (or `psql` with service-role
credentials):

```sql
update app_users
set is_super_admin = true
where id = (select id from auth.users where email = 'you@example.com');
```

The target user must already have signed into the app at least once so
their `app_users` row exists. If it doesn't, the `on_auth_user_created`
trigger should have created it — if not, insert the row:

```sql
insert into app_users (id, is_super_admin)
select id, true from auth.users where email = 'you@example.com'
on conflict (id) do update set is_super_admin = true;
```

## If no one can sign in at all

Create a new `auth.users` row directly (bypasses the signup UI). You must
ALSO create a matching `auth.identities` row — GoTrue rejects sign-in
attempts for any user without one, with "Database error querying schema":

```sql
with new_user as (
  insert into auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    aud, role, raw_app_meta_data,
    confirmation_token, recovery_token, email_change_token_new,
    email_change_token_current, email_change, reauthentication_token,
    phone_change, phone_change_token,
    created_at, updated_at
  ) values (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'recovery@example.com',
    extensions.crypt('CHANGE_ME_IMMEDIATELY', extensions.gen_salt('bf')),
    now(),
    'authenticated',
    'authenticated',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '', '', '', '', '', '', '', '',
    now(), now()
  )
  returning id, email
)
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), id, id::text,
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  'email', now(), now(), now()
from new_user;
```

The `''` string defaults on the token columns are required — GoTrue
2.188+ reads them into non-nullable Go strings and NULL values cause
"Database error querying schema" on login.

Then promote that user with the query above. **Rotate the password
immediately** via the app's password-reset flow.

## Why this isn't a UI button

By design. If it were a button, a compromised session could use it. The
escape hatch deliberately requires service-role DB access.
