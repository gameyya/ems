-- EMS Initial Schema
-- All tables, enums, constraints. RLS enabled but policies come in 0002.

create extension if not exists "pgcrypto";

-- ---------- ENUMS ----------
do $$ begin
  create type user_role as enum ('admin', 'staff', 'finance');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('cash', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance_status as enum ('present', 'absent');
exception when duplicate_object then null; end $$;

-- ---------- HELPERS ----------
-- Sequence + function for human-readable student/receipt codes
create sequence if not exists student_code_seq start 1000;
create sequence if not exists receipt_code_seq start 10000;
create sequence if not exists class_code_seq start 100;

create or replace function gen_student_code() returns text
language sql volatile as $$
  select 'STU-' || lpad(nextval('student_code_seq')::text, 6, '0');
$$;

create or replace function gen_receipt_code() returns text
language sql volatile as $$
  select 'RCP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('receipt_code_seq')::text, 6, '0');
$$;

create or replace function gen_class_code() returns text
language sql volatile as $$
  select 'CLS-' || lpad(nextval('class_code_seq')::text, 4, '0');
$$;

-- ---------- PROFILES (bridges auth.users + role) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        user_role not null default 'staff',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Current user's role (SECURITY DEFINER so RLS policies can read without recursion)
create or replace function public.current_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_staff_or_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','staff'));
$$;

create or replace function public.is_finance_or_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','finance'));
$$;

-- ---------- SETTINGS (single row) ----------
create table if not exists public.settings (
  id              integer primary key default 1,
  institution_name text not null default 'Educational Management System',
  institution_name_ar text not null default 'نظام إدارة المؤسسة التعليمية',
  logo_url        text,
  address         text,
  phone           text,
  currency_code   text not null default 'EGP',
  updated_at      timestamptz not null default now(),
  constraint single_row check (id = 1)
);

insert into public.settings (id) values (1) on conflict do nothing;

-- ---------- STUDENTS ----------
create table if not exists public.students (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique default gen_student_code(),
  full_name     text not null,
  phone         text,
  parent_name   text,
  parent_phone  text,
  address       text,
  notes         text,
  enrollment_date date not null default current_date,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists students_full_name_idx on public.students using gin (to_tsvector('simple', full_name));
create index if not exists students_code_idx on public.students (code);
create index if not exists students_deleted_idx on public.students (deleted_at);

-- ---------- TEACHERS ----------
create table if not exists public.teachers (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null,
  phone        text,
  specialty    text,
  payment_type text,
  salary       numeric(12,2),
  notes        text,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists teachers_full_name_idx on public.teachers using gin (to_tsvector('simple', full_name));

-- ---------- CLASSES ----------
create table if not exists public.classes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique default gen_class_code(),
  name        text not null,
  teacher_id  uuid references public.teachers(id) on delete restrict,
  schedule_days text[] not null default '{}',
  schedule_time text,
  capacity    integer,
  notes       text,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint capacity_positive check (capacity is null or capacity > 0)
);

create index if not exists classes_teacher_idx on public.classes (teacher_id);

-- ---------- ENROLLMENTS (student <-> class M2M) ----------
create table if not exists public.enrollments (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  class_id   uuid not null references public.classes(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  unique (student_id, class_id)
);

create index if not exists enrollments_student_idx on public.enrollments (student_id);
create index if not exists enrollments_class_idx on public.enrollments (class_id);

-- ---------- PAYMENTS (IMMUTABLE once created) ----------
create table if not exists public.payments (
  id             uuid primary key default gen_random_uuid(),
  receipt_code   text not null unique default gen_receipt_code(),
  student_id     uuid not null references public.students(id) on delete restrict,
  amount         numeric(12,2) not null check (amount > 0),
  method         payment_method not null default 'cash',
  payment_date   date not null default current_date,
  notes          text,
  cancelled_at   timestamptz,
  cancelled_by   uuid references auth.users(id),
  cancel_reason  text,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now()
);

create index if not exists payments_student_idx on public.payments (student_id);
create index if not exists payments_date_idx on public.payments (payment_date);
create index if not exists payments_receipt_idx on public.payments (receipt_code);

-- Prevent UPDATE on core fields (only cancellation fields may change)
create or replace function public.payments_immutable() returns trigger
language plpgsql as $$
begin
  if new.id <> old.id
     or new.receipt_code <> old.receipt_code
     or new.student_id <> old.student_id
     or new.amount <> old.amount
     or new.method <> old.method
     or new.payment_date <> old.payment_date
     or coalesce(new.notes,'') <> coalesce(old.notes,'')
     or new.created_by is distinct from old.created_by
     or new.created_at <> old.created_at
  then
    raise exception 'Payment core fields are immutable. Use cancellation instead.';
  end if;
  -- Prevent un-cancellation
  if old.cancelled_at is not null and new.cancelled_at is null then
    raise exception 'Cannot un-cancel a payment.';
  end if;
  return new;
end $$;

drop trigger if exists trg_payments_immutable on public.payments;
create trigger trg_payments_immutable
before update on public.payments
for each row execute function public.payments_immutable();

-- Forbid DELETE on payments
create or replace function public.payments_no_delete() returns trigger
language plpgsql as $$
begin
  raise exception 'Payments cannot be deleted. Cancel instead.';
end $$;

drop trigger if exists trg_payments_no_delete on public.payments;
create trigger trg_payments_no_delete
before delete on public.payments
for each row execute function public.payments_no_delete();

-- ---------- ATTENDANCE ----------
create table if not exists public.attendance (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  class_id   uuid not null references public.classes(id) on delete cascade,
  date       date not null default current_date,
  status     attendance_status not null default 'present',
  notes      text,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (student_id, class_id, date)
);

create index if not exists attendance_class_date_idx on public.attendance (class_id, date);

-- ---------- updated_at triggers ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['students','teachers','classes','profiles','settings'] loop
    execute format('drop trigger if exists trg_updated_at on public.%I;', t);
    execute format('create trigger trg_updated_at before update on public.%I for each row execute function public.set_updated_at();', t);
  end loop;
end $$;
