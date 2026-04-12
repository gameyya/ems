-- Convenience views + aggregations for reports

create or replace view public.v_class_enrollment_counts as
select c.id as class_id, c.name, c.capacity, count(e.id)::int as enrolled
from public.classes c
left join public.enrollments e on e.class_id = c.id
where c.deleted_at is null
group by c.id;

create or replace view public.v_student_balance as
select s.id as student_id,
       s.full_name,
       coalesce(sum(case when p.cancelled_at is null then p.amount else 0 end), 0) as total_paid,
       count(p.id) filter (where p.cancelled_at is null) as payment_count
from public.students s
left join public.payments p on p.student_id = s.id
where s.deleted_at is null
group by s.id, s.full_name;

grant select on public.v_class_enrollment_counts to authenticated;
grant select on public.v_student_balance to authenticated;
