-- Enforce one class per student + dedup public registrations by name + phone.
-- Per spec change: a student belongs to AT MOST one class. When somebody fills
-- the public registration form (or staff approves it), reuse an existing student
-- if name+phone matches; reject if that existing student is already enrolled.

-- ---------- ENROLLMENTS: replace composite uniqueness with single-column ----------
alter table public.enrollments
  drop constraint if exists enrollments_student_id_class_id_key;

alter table public.enrollments
  add constraint enrollments_student_unique unique (student_id);

-- ---------- helper: match an existing non-deleted student by (name + phone) ----------
create or replace function public._match_existing_student(p_full_name text, p_phone text)
returns uuid
language sql stable security definer set search_path = public as $$
  select id
    from public.students
   where deleted_at is null
     and lower(trim(full_name)) = lower(trim(p_full_name))
     and coalesce(trim(phone),'') = coalesce(trim(p_phone),'')
   limit 1
$$;

-- ---------- replace submit RPC: dedup-aware ----------
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
  v_existing_id uuid;
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

  -- Early guard: if a matching student exists and is already enrolled anywhere → reject.
  v_existing_id := public._match_existing_student(p_full_name, p_phone);
  if v_existing_id is not null
     and exists (select 1 from public.enrollments where student_id = v_existing_id) then
    raise exception 'student_already_enrolled';
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

  -- Auto-approve path: reuse existing student if matched, else create new.
  if v_existing_id is null then
    insert into public.students (full_name, phone, parent_name, parent_phone, address, notes)
    values (trim(p_full_name), nullif(trim(coalesce(p_phone,'')),''),
            nullif(trim(coalesce(p_parent_name,'')),''),
            nullif(trim(coalesce(p_parent_phone,'')),''),
            nullif(trim(coalesce(p_address,'')),''),
            nullif(trim(coalesce(p_notes,'')),''))
    returning id into v_student_id;
  else
    v_student_id := v_existing_id;
  end if;

  insert into public.enrollments (student_id, class_id)
  values (v_student_id, v_class.id);

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

-- ---------- replace approve RPC: dedup-aware ----------
create or replace function public.approve_class_registration(p_reg_id uuid)
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  v_reg public.class_registrations%rowtype;
  v_student_id uuid;
  v_existing_id uuid;
begin
  if not public.is_staff_or_admin() then
    raise exception 'forbidden';
  end if;

  select * into v_reg from public.class_registrations where id = p_reg_id for update;
  if not found then raise exception 'registration_not_found'; end if;
  if v_reg.status <> 'pending' then raise exception 'already_reviewed'; end if;

  v_existing_id := public._match_existing_student(v_reg.full_name, v_reg.phone);
  if v_existing_id is not null
     and exists (select 1 from public.enrollments where student_id = v_existing_id) then
    raise exception 'student_already_enrolled';
  end if;

  if v_existing_id is null then
    insert into public.students (full_name, phone, parent_name, parent_phone, address, notes)
    values (v_reg.full_name, v_reg.phone, v_reg.parent_name, v_reg.parent_phone,
            v_reg.address, v_reg.notes)
    returning id into v_student_id;
  else
    v_student_id := v_existing_id;
  end if;

  insert into public.enrollments (student_id, class_id)
  values (v_student_id, v_reg.class_id);

  update public.class_registrations
     set status = 'approved',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         created_student_id = v_student_id
   where id = p_reg_id;

  return v_student_id;
end $$;
