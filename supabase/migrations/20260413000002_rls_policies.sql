-- RLS Policies
-- Admin: full access everywhere
-- Staff: manage students/teachers/classes/enrollments/attendance; record payments; read-only reports
-- Finance: manage payments; read students/teachers/classes for context; read-only reports

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.students enable row level security;
alter table public.teachers enable row level security;
alter table public.classes enable row level security;
alter table public.enrollments enable row level security;
alter table public.payments enable row level security;
alter table public.attendance enable row level security;

-- ---------- PROFILES ----------
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- SETTINGS ----------
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings
  for select using (auth.uid() is not null);

drop policy if exists settings_admin_write on public.settings;
create policy settings_admin_write on public.settings
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------- STUDENTS ----------
drop policy if exists students_read on public.students;
create policy students_read on public.students
  for select using (auth.uid() is not null);

drop policy if exists students_staff_write on public.students;
create policy students_staff_write on public.students
  for insert with check (public.is_staff_or_admin());

drop policy if exists students_staff_update on public.students;
create policy students_staff_update on public.students
  for update using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

drop policy if exists students_admin_delete on public.students;
create policy students_admin_delete on public.students
  for delete using (public.is_admin());

-- ---------- TEACHERS ----------
drop policy if exists teachers_read on public.teachers;
create policy teachers_read on public.teachers
  for select using (auth.uid() is not null);

drop policy if exists teachers_staff_write on public.teachers;
create policy teachers_staff_write on public.teachers
  for insert with check (public.is_staff_or_admin());

drop policy if exists teachers_staff_update on public.teachers;
create policy teachers_staff_update on public.teachers
  for update using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

drop policy if exists teachers_admin_delete on public.teachers;
create policy teachers_admin_delete on public.teachers
  for delete using (public.is_admin());

-- ---------- CLASSES ----------
drop policy if exists classes_read on public.classes;
create policy classes_read on public.classes
  for select using (auth.uid() is not null);

drop policy if exists classes_staff_write on public.classes;
create policy classes_staff_write on public.classes
  for insert with check (public.is_staff_or_admin());

drop policy if exists classes_staff_update on public.classes;
create policy classes_staff_update on public.classes
  for update using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

drop policy if exists classes_admin_delete on public.classes;
create policy classes_admin_delete on public.classes
  for delete using (public.is_admin());

-- ---------- ENROLLMENTS ----------
drop policy if exists enrollments_read on public.enrollments;
create policy enrollments_read on public.enrollments
  for select using (auth.uid() is not null);

drop policy if exists enrollments_staff_write on public.enrollments;
create policy enrollments_staff_write on public.enrollments
  for all using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

-- ---------- PAYMENTS ----------
drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments
  for select using (auth.uid() is not null);

-- Insert: staff or finance (both can record payments per spec)
drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments
  for insert with check (public.is_staff_or_admin() or public.is_finance_or_admin());

-- Update: only finance or admin (for cancellation, enforced by trigger on columns)
drop policy if exists payments_cancel on public.payments;
create policy payments_cancel on public.payments
  for update using (public.is_finance_or_admin()) with check (public.is_finance_or_admin());

-- DELETE is blocked by trigger (no policy needed, but explicitly deny)
drop policy if exists payments_no_delete_policy on public.payments;
create policy payments_no_delete_policy on public.payments
  for delete using (false);

-- ---------- ATTENDANCE ----------
drop policy if exists attendance_read on public.attendance;
create policy attendance_read on public.attendance
  for select using (auth.uid() is not null);

drop policy if exists attendance_staff_write on public.attendance;
create policy attendance_staff_write on public.attendance
  for all using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());
