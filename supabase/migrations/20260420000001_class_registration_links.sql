-- Class registration links + public submission queue
-- Allows staff to generate shareable links per class. Public (anon) can submit
-- a registration through a valid link; submissions land in a pending queue
-- that staff approves (creating the student + enrollment) or rejects.
-- Optionally, staff can deactivate the queue per-class — submissions then
-- auto-approve on arrival.

-- ---------- per-class queue toggle ----------
alter table public.classes
  add column if not exists registration_queue_active boolean not null default true;

-- ---------- REGISTRATION LINKS ----------
create table if not exists public.class_registration_links (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes(id) on delete cascade,
  token       text not null unique default encode(gen_random_bytes(18), 'base64'),
  expires_at  timestamptz,
  enabled     boolean not null default true,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create index if not exists class_registration_links_class_idx
  on public.class_registration_links (class_id);
create index if not exists class_registration_links_token_idx
  on public.class_registration_links (token);

-- ---------- PENDING REGISTRATIONS ----------
do $$ begin
  create type class_registration_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.class_registrations (
  id            uuid primary key default gen_random_uuid(),
  class_id      uuid not null references public.classes(id) on delete cascade,
  link_id       uuid references public.class_registration_links(id) on delete set null,
  full_name     text not null,
  phone         text,
  parent_name   text,
  parent_phone  text,
  address       text,
  notes         text,
  status        class_registration_status not null default 'pending',
  reviewed_by   uuid references auth.users(id),
  reviewed_at   timestamptz,
  created_student_id uuid references public.students(id),
  created_at    timestamptz not null default now()
);

create index if not exists class_registrations_class_status_idx
  on public.class_registrations (class_id, status);

-- ---------- RLS ----------
alter table public.class_registration_links enable row level security;
alter table public.class_registrations enable row level security;

drop policy if exists crl_read on public.class_registration_links;
create policy crl_read on public.class_registration_links
  for select using (auth.uid() is not null);

drop policy if exists crl_staff_write on public.class_registration_links;
create policy crl_staff_write on public.class_registration_links
  for all using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

drop policy if exists cr_read on public.class_registrations;
create policy cr_read on public.class_registrations
  for select using (auth.uid() is not null);

drop policy if exists cr_staff_write on public.class_registrations;
create policy cr_staff_write on public.class_registrations
  for all using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

-- ---------- PUBLIC RPCs (callable by anon) ----------

-- Return minimal class info if the token is valid, enabled and not expired.
create or replace function public.get_class_registration_info(p_token text)
returns table (class_id uuid, class_name text, class_code text, queue_active boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
    select c.id, c.name, c.code, c.registration_queue_active
    from public.class_registration_links l
    join public.classes c on c.id = l.class_id
    where l.token = p_token
      and l.enabled = true
      and (l.expires_at is null or l.expires_at > now())
      and c.deleted_at is null;
end $$;

-- Submit a registration through a valid link. Honors the per-class queue toggle:
-- if the queue is active → inserts as pending; otherwise auto-approves by creating
-- the student + enrollment and inserting an already-approved registration row.
create or replace function public.submit_class_registration(
  p_token text,
  p_full_name text,
  p_phone text default null,
  p_parent_name text default null,
  p_parent_phone text default null,
  p_address text default null,
  p_notes text default null
) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  v_link   public.class_registration_links%rowtype;
  v_class  public.classes%rowtype;
  v_reg_id uuid;
  v_student_id uuid;
begin
  if p_full_name is null or length(trim(p_full_name)) < 2 then
    raise exception 'full_name is required';
  end if;

  select * into v_link from public.class_registration_links where token = p_token;
  if not found or not v_link.enabled
     or (v_link.expires_at is not null and v_link.expires_at <= now()) then
    raise exception 'link_invalid';
  end if;

  select * into v_class from public.classes where id = v_link.class_id;
  if not found or v_class.deleted_at is not null then
    raise exception 'link_invalid';
  end if;

  if v_class.registration_queue_active then
    insert into public.class_registrations
      (class_id, link_id, full_name, phone, parent_name, parent_phone, address, notes)
    values
      (v_class.id, v_link.id, trim(p_full_name), nullif(trim(coalesce(p_phone,'')),''),
       nullif(trim(coalesce(p_parent_name,'')),''),
       nullif(trim(coalesce(p_parent_phone,'')),''),
       nullif(trim(coalesce(p_address,'')),''),
       nullif(trim(coalesce(p_notes,'')),''))
    returning id into v_reg_id;
    return v_reg_id;
  end if;

  -- Queue disabled → auto-approve: create student + enrollment directly.
  insert into public.students (full_name, phone, parent_name, parent_phone, address, notes)
  values (trim(p_full_name), nullif(trim(coalesce(p_phone,'')),''),
          nullif(trim(coalesce(p_parent_name,'')),''),
          nullif(trim(coalesce(p_parent_phone,'')),''),
          nullif(trim(coalesce(p_address,'')),''),
          nullif(trim(coalesce(p_notes,'')),''))
  returning id into v_student_id;

  insert into public.enrollments (student_id, class_id)
  values (v_student_id, v_class.id)
  on conflict (student_id, class_id) do nothing;

  insert into public.class_registrations
    (class_id, link_id, full_name, phone, parent_name, parent_phone, address, notes,
     status, reviewed_at, created_student_id)
  values
    (v_class.id, v_link.id, trim(p_full_name), nullif(trim(coalesce(p_phone,'')),''),
     nullif(trim(coalesce(p_parent_name,'')),''),
     nullif(trim(coalesce(p_parent_phone,'')),''),
     nullif(trim(coalesce(p_address,'')),''),
     nullif(trim(coalesce(p_notes,'')),''),
     'approved', now(), v_student_id)
  returning id into v_reg_id;
  return v_reg_id;
end $$;

-- Staff-only RPC: approve a pending registration → creates student + enrollment.
create or replace function public.approve_class_registration(p_reg_id uuid)
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  v_reg public.class_registrations%rowtype;
  v_student_id uuid;
begin
  if not public.is_staff_or_admin() then
    raise exception 'forbidden';
  end if;

  select * into v_reg from public.class_registrations where id = p_reg_id for update;
  if not found then raise exception 'registration_not_found'; end if;
  if v_reg.status <> 'pending' then raise exception 'already_reviewed'; end if;

  insert into public.students (full_name, phone, parent_name, parent_phone, address, notes)
  values (v_reg.full_name, v_reg.phone, v_reg.parent_name, v_reg.parent_phone,
          v_reg.address, v_reg.notes)
  returning id into v_student_id;

  insert into public.enrollments (student_id, class_id)
  values (v_student_id, v_reg.class_id)
  on conflict (student_id, class_id) do nothing;

  update public.class_registrations
     set status = 'approved',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         created_student_id = v_student_id
   where id = p_reg_id;

  return v_student_id;
end $$;

create or replace function public.reject_class_registration(p_reg_id uuid)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_staff_or_admin() then
    raise exception 'forbidden';
  end if;

  update public.class_registrations
     set status = 'rejected',
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_reg_id and status = 'pending';

  if not found then raise exception 'registration_not_found_or_already_reviewed'; end if;
end $$;

-- Pending-count view for the classes page badge.
create or replace view public.v_class_pending_registrations as
select class_id, count(*)::int as pending
from public.class_registrations
where status = 'pending'
group by class_id;

grant select on public.v_class_pending_registrations to authenticated;

-- Permissions: public form is callable by anon; staff-only RPCs only to authenticated.
grant execute on function public.get_class_registration_info(text) to anon, authenticated;
grant execute on function public.submit_class_registration(text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.approve_class_registration(uuid) to authenticated;
grant execute on function public.reject_class_registration(uuid) to authenticated;
