create or replace view public.student_current_courses
with (security_invoker = true)
as
select
  enrollment.student_id,
  course.code,
  course.title,
  section.section_code,
  section.id as section_id,
  coalesce(meeting.schedule, 'Schedule to be announced') as schedule,
  coalesce(section.location, 'To be announced') as location,
  coalesce(instructor_names.names, 'Staff') as instructor
from public.enrollments enrollment
join public.course_sections section on section.id = enrollment.section_id
join public.courses course on course.id = section.course_id
left join lateral (
  select string_agg(
    case section_meeting.weekday
      when 1 then 'Mon'
      when 2 then 'Tue'
      when 3 then 'Wed'
      when 4 then 'Thu'
      when 5 then 'Fri'
      when 6 then 'Sat'
      when 7 then 'Sun'
    end
      || ' / '
      || to_char(section_meeting.starts_at, 'HH12:MI AM')
      || '-'
      || to_char(section_meeting.ends_at, 'HH12:MI AM'),
    ', '
    order by section_meeting.weekday, section_meeting.starts_at
  ) as schedule
  from public.section_meetings section_meeting
  where section_meeting.section_id = section.id
) meeting on true
left join lateral (
  select string_agg(profile.display_name, ', ' order by profile.display_name) as names
  from public.section_instructors section_instructor
  join public.staff_role_assignments staff_role
    on staff_role.id = section_instructor.staff_role_assignment_id
  join public.profiles profile on profile.id = staff_role.user_id
  where section_instructor.section_id = section.id
) instructor_names on true
where enrollment.status = 'enrolled';

create or replace view public.student_recent_activity
with (security_invoker = true)
as
select
  enrollment.student_id,
  enrollment.id as activity_id,
  'Enrollment confirmed'::text as title,
  course.code || ' / ' || course.title as detail,
  enrollment.enrolled_at as occurred_at,
  'teal'::text as tone
from public.enrollments enrollment
join public.course_sections section on section.id = enrollment.section_id
join public.courses course on course.id = section.course_id
where enrollment.status = 'enrolled'
union all
select
  enrollment.student_id,
  grade_record.id as activity_id,
  'Academic record published'::text as title,
  course.code || ' was added to your verified history' as detail,
  grade_record.published_at as occurred_at,
  'gold'::text as tone
from public.grade_records grade_record
join public.enrollments enrollment on enrollment.id = grade_record.enrollment_id
join public.course_sections section on section.id = enrollment.section_id
join public.courses course on course.id = section.course_id
where grade_record.is_current;
