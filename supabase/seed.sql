-- Synthetic data only. Never replace these rows with real student information.

insert into auth.users (
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
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000101',
    'authenticated',
    'authenticated',
    'aisha.demo@lozzi.example',
    crypt('Northstar-Demo-2026!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Aisha Rahman","synthetic":true}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000102',
    'authenticated',
    'authenticated',
    'mateo.demo@lozzi.example',
    crypt('Synthetic-Only-2026!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Mateo Silva","synthetic":true}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000103',
    'authenticated',
    'authenticated',
    'priya.demo@lozzi.example',
    crypt('Synthetic-Only-2026!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Priya Nair","synthetic":true}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000201',
    'authenticated',
    'authenticated',
    'jordan.registrar@lozzi.example',
    crypt('Synthetic-Only-2026!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Jordan Lee","synthetic":true}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000202',
    'authenticated',
    'authenticated',
    'elena.instructor@lozzi.example',
    crypt('Synthetic-Only-2026!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Elena Martinez","synthetic":true}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000203',
    'authenticated',
    'authenticated',
    'james.instructor@lozzi.example',
    crypt('Synthetic-Only-2026!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"James Wilson","synthetic":true}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000204',
    'authenticated',
    'authenticated',
    'casey.advisor@lozzi.example',
    crypt('Synthetic-Only-2026!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Casey Nguyen","synthetic":true}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
on conflict (id) do nothing;

insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  user_record.id,
  user_record.id,
  user_record.id::text,
  jsonb_build_object(
    'sub', user_record.id::text,
    'email', user_record.email,
    'email_verified', true
  ),
  'email',
  now(),
  now(),
  now()
from auth.users user_record
where user_record.id in (
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000102',
  '00000000-0000-4000-8000-000000000103',
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000202',
  '00000000-0000-4000-8000-000000000203',
  '00000000-0000-4000-8000-000000000204'
)
on conflict (provider_id, provider) do nothing;

insert into public.institutions (
  id,
  slug,
  name,
  status,
  created_by,
  updated_by
)
values (
  '10000000-0000-4000-8000-000000000001',
  'northstar-university',
  'Northstar University',
  'active',
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000201'
);

insert into public.profiles (id, display_name, initials)
values
  ('00000000-0000-4000-8000-000000000101', 'Aisha Rahman', 'AR'),
  ('00000000-0000-4000-8000-000000000102', 'Mateo Silva', 'MS'),
  ('00000000-0000-4000-8000-000000000103', 'Priya Nair', 'PN'),
  ('00000000-0000-4000-8000-000000000201', 'Jordan Lee', 'JL'),
  ('00000000-0000-4000-8000-000000000202', 'Elena Martinez', 'EM'),
  ('00000000-0000-4000-8000-000000000203', 'James Wilson', 'JW'),
  ('00000000-0000-4000-8000-000000000204', 'Casey Nguyen', 'CN');

insert into public.institution_memberships (
  id,
  institution_id,
  user_id,
  role,
  created_by,
  updated_by
)
values
  ('11000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'student', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000201'),
  ('11000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'student', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000201'),
  ('11000000-0000-4000-8000-000000000103', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000103', 'student', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000201'),
  ('11000000-0000-4000-8000-000000000201', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'registrar', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000201'),
  ('11000000-0000-4000-8000-000000000202', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 'instructor', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000201'),
  ('11000000-0000-4000-8000-000000000203', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203', 'instructor', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000201'),
  ('11000000-0000-4000-8000-000000000204', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000204', 'advisor', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000201');

insert into public.staff_role_assignments (
  id,
  institution_id,
  user_id,
  role,
  created_by,
  updated_by
)
values
  ('12000000-0000-4000-8000-000000000201', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'registrar', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000201'),
  ('12000000-0000-4000-8000-000000000202', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 'instructor', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000201'),
  ('12000000-0000-4000-8000-000000000203', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203', 'instructor', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000201'),
  ('12000000-0000-4000-8000-000000000204', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000204', 'advisor', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000201');

insert into public.students (
  id,
  institution_id,
  user_id,
  student_number,
  pseudonymous_id,
  academic_status,
  expected_completion_date,
  created_by,
  updated_by
)
values
  ('13000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'NSU-2026-1001', 'urn:lozzi:student:synthetic-aisha', 'active', '2030-05-15', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000201'),
  ('13000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'NSU-2026-1002', 'urn:lozzi:student:synthetic-mateo', 'active', '2030-05-15', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000201'),
  ('13000000-0000-4000-8000-000000000103', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000103', 'NSU-2026-1003', 'urn:lozzi:student:synthetic-priya', 'active', '2030-05-15', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000201');

insert into public.departments (
  id,
  institution_id,
  code,
  name,
  created_by,
  updated_by
)
values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'CS',
  'College of Computing · Department of Computer Science',
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000201'
);

insert into public.academic_terms (
  id,
  institution_id,
  code,
  name,
  starts_on,
  ends_on,
  registration_opens_at,
  registration_closes_at,
  add_drop_deadline,
  withdrawal_deadline,
  grades_due_at,
  status,
  created_by,
  updated_by
)
values (
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'FALL-2026',
  'Fall 2026',
  '2026-08-24',
  '2026-12-20',
  '2026-04-01 08:00:00+00',
  '2026-09-06 23:59:59+00',
  '2026-09-06 23:59:59+00',
  '2026-11-15 23:59:59+00',
  '2026-12-18 23:59:59+00',
  'registration_open',
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000201'
);

insert into public.programs (
  id,
  institution_id,
  department_id,
  code,
  name,
  credential_type,
  created_by,
  updated_by
)
values (
  '40000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'BS-CS',
  'Bachelor of Science in Computer Science',
  'bachelors',
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000201'
);

insert into public.program_versions (
  id,
  institution_id,
  program_id,
  version_number,
  effective_term_id,
  required_credits,
  status,
  published_at,
  created_by,
  updated_by
)
values (
  '41000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  1,
  '30000000-0000-4000-8000-000000000001',
  120,
  'published',
  '2026-01-15 10:00:00+00',
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000201'
);

insert into public.courses (
  id,
  institution_id,
  department_id,
  code,
  title,
  credit_hours,
  created_by,
  updated_by
)
values
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'CS 1301', 'Introduction to Programming', 3, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000201'),
  ('50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'CS 2305', 'Data Structures', 3, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000201'),
  ('50000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'CS 3300', 'Algorithms', 3, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000201'),
  ('50000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'MATH 1314', 'Calculus I', 3, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000201'),
  ('50000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'MATH 2314', 'Calculus II', 3, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000201'),
  ('50000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'ENGL 1301', 'Academic Writing', 3, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000201');

insert into public.course_prerequisites (
  id,
  institution_id,
  course_id,
  prerequisite_course_id
)
values
  ('51000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001'),
  ('51000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000002'),
  ('51000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000004');

insert into public.program_requirements (
  id,
  institution_id,
  program_version_id,
  course_id,
  requirement_group,
  minimum_credits,
  sort_order,
  created_by,
  updated_by
)
select
  gen_random_uuid(),
  '10000000-0000-4000-8000-000000000001',
  '41000000-0000-4000-8000-000000000001',
  course.id,
  case when course.code like 'CS %' then 'Computer science core' else 'General education' end,
  course.credit_hours,
  row_number() over (order by course.code),
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000201'
from public.courses course
where course.institution_id = '10000000-0000-4000-8000-000000000001';

insert into public.student_programs (
  id,
  institution_id,
  student_id,
  program_version_id,
  created_by,
  updated_by
)
values
  ('42000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000101', '41000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000201'),
  ('42000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000102', '41000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000201'),
  ('42000000-0000-4000-8000-000000000103', '10000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000103', '41000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000201');

insert into public.course_sections (
  id,
  institution_id,
  course_id,
  term_id,
  section_code,
  capacity,
  enrolled_count,
  location,
  status,
  created_by,
  updated_by
)
values
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', '01', 2, 1, 'Computing Hall 204', 'open', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000201');

insert into public.section_instructors (
  id,
  institution_id,
  section_id,
  staff_role_assignment_id,
  is_primary
)
values
  ('61000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000202', true);

insert into public.section_meetings (
  id,
  institution_id,
  section_id,
  weekday,
  starts_at,
  ends_at,
  location
)
values
  ('62000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 1, '10:00', '11:15', 'Computing Hall 204'),
  ('62000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 3, '10:00', '11:15', 'Computing Hall 204');

insert into public.enrollments (
  id,
  institution_id,
  student_id,
  section_id,
  status,
  credit_hours,
  enrolled_at,
  idempotency_key,
  created_by,
  updated_by
)
values
  ('70000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000101', '60000000-0000-4000-8000-000000000001', 'enrolled', 3, '2026-04-03 14:20:00+00', '70000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000101');

-- A completed historical section is intentionally separate from the two Fall demo sections.
insert into public.course_sections (
  id,
  institution_id,
  course_id,
  term_id,
  section_code,
  capacity,
  enrolled_count,
  location,
  status,
  created_by,
  updated_by
)
values (
  '60000000-0000-4000-8000-000000000099',
  '10000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'HIST',
  30,
  2,
  'Archived synthetic section',
  'closed',
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000201'
);

insert into public.enrollments (
  id,
  institution_id,
  student_id,
  section_id,
  status,
  credit_hours,
  enrolled_at,
  idempotency_key,
  created_by,
  updated_by
)
values (
  '70000000-0000-4000-8000-000000000099',
  '10000000-0000-4000-8000-000000000001',
  '13000000-0000-4000-8000-000000000101',
  '60000000-0000-4000-8000-000000000099',
  'completed',
  3,
  '2026-01-08 09:00:00+00',
  '70000000-0000-4000-8000-000000000099',
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000201'
);

insert into public.enrollments (
  id,
  institution_id,
  student_id,
  section_id,
  status,
  credit_hours,
  enrolled_at,
  idempotency_key,
  created_by,
  updated_by
)
values (
  '70000000-0000-4000-8000-000000000102',
  '10000000-0000-4000-8000-000000000001',
  '13000000-0000-4000-8000-000000000102',
  '60000000-0000-4000-8000-000000000099',
  'completed',
  3,
  '2026-01-08 09:05:00+00',
  '70000000-0000-4000-8000-000000000102',
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000201'
);

insert into public.grade_submissions (
  id,
  institution_id,
  enrollment_id,
  submitted_by,
  state,
  grade_code,
  grade_points,
  submitted_at,
  approved_at,
  published_at,
  created_by,
  updated_by
)
values (
  '71000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000099',
  '00000000-0000-4000-8000-000000000202',
  'published',
  'A',
  4,
  '2026-05-20 13:00:00+00',
  '2026-05-21 10:00:00+00',
  '2026-05-21 11:00:00+00',
  '00000000-0000-4000-8000-000000000202',
  '00000000-0000-4000-8000-000000000201'
);

insert into public.grade_submissions (
  id,
  institution_id,
  enrollment_id,
  submitted_by,
  state,
  grade_code,
  grade_points,
  submitted_at,
  approved_at,
  created_by,
  updated_by
)
values (
  '71000000-0000-4000-8000-000000000102',
  '10000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000102',
  '00000000-0000-4000-8000-000000000202',
  'approved',
  'B',
  3,
  '2026-05-22 09:20:00+00',
  '2026-05-22 11:00:00+00',
  '00000000-0000-4000-8000-000000000202',
  '00000000-0000-4000-8000-000000000201'
);

insert into public.grade_records (
  id,
  institution_id,
  enrollment_id,
  grade_submission_id,
  version_number,
  grade_code,
  grade_points,
  credit_hours_earned,
  published_at,
  created_by
)
values (
  '72000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000099',
  '71000000-0000-4000-8000-000000000001',
  1,
  'A',
  4,
  3,
  '2026-05-21 11:00:00+00',
  '00000000-0000-4000-8000-000000000201'
);

insert into public.academic_record_versions (
  id,
  institution_id,
  student_id,
  version_number,
  content_commitment,
  salt_reference,
  status,
  anchor_status,
  published_at,
  created_by
)
values (
  '73000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '13000000-0000-4000-8000-000000000101',
  1,
  decode(repeat('ab', 32), 'hex'),
  'synthetic-fixture-v1',
  'published',
  'not_configured',
  '2026-05-21 11:05:00+00',
  '00000000-0000-4000-8000-000000000201'
);

insert into public.degree_audit_snapshots (
  id,
  institution_id,
  student_id,
  student_program_id,
  academic_record_version_id,
  credits_earned,
  credits_required,
  gpa,
  progress_percent,
  requirement_results,
  calculated_at,
  created_by
)
values (
  '74000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '13000000-0000-4000-8000-000000000101',
  '42000000-0000-4000-8000-000000000101',
  '73000000-0000-4000-8000-000000000001',
  3,
  120,
  4,
  3,
  '[{"code":"CS 1301","status":"complete"},{"code":"CS 2305","status":"in-progress"}]',
  '2026-05-21 11:06:00+00',
  '00000000-0000-4000-8000-000000000201'
);

insert into public.advisor_assignments (
  id,
  institution_id,
  student_id,
  advisor_role_assignment_id,
  created_by,
  updated_by
)
values (
  '75000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '13000000-0000-4000-8000-000000000101',
  '12000000-0000-4000-8000-000000000204',
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000201'
);

insert into public.student_holds (
  id,
  institution_id,
  student_id,
  hold_type,
  reason_code,
  is_blocking,
  created_by,
  updated_by
)
values (
  '76000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '13000000-0000-4000-8000-000000000103',
  'administrative',
  'SYNTHETIC_DOCUMENT_REVIEW',
  true,
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000201'
);

insert into public.record_share_grants (
  id,
  institution_id,
  student_id,
  academic_record_version_id,
  token_hash,
  grant_commitment,
  recipient_label,
  scopes,
  status,
  expires_at,
  revoked_at,
  created_at,
  updated_at,
  created_by
)
values
  (
    '77000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '13000000-0000-4000-8000-000000000101',
    '73000000-0000-4000-8000-000000000001',
    digest('lozzi-valid-demo-token', 'sha256'),
    decode(repeat('cd', 32), 'hex'),
    'Synthetic graduate-program verifier',
    array['program', 'degree-progress'],
    'active',
    '2027-01-15 12:00:00+00',
    null,
    '2026-07-01 12:00:00+00',
    '2026-07-01 12:00:00+00',
    '00000000-0000-4000-8000-000000000101'
  ),
  (
    '77000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '13000000-0000-4000-8000-000000000101',
    '73000000-0000-4000-8000-000000000001',
    digest('lozzi-expired-demo-token', 'sha256'),
    decode(repeat('de', 32), 'hex'),
    'Expired synthetic verifier',
    array['program'],
    'expired',
    '2026-01-15 12:00:00+00',
    null,
    '2025-12-01 12:00:00+00',
    '2026-01-15 12:00:00+00',
    '00000000-0000-4000-8000-000000000101'
  ),
  (
    '77000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '13000000-0000-4000-8000-000000000101',
    '73000000-0000-4000-8000-000000000001',
    digest('lozzi-revoked-demo-token', 'sha256'),
    decode(repeat('ef', 32), 'hex'),
    'Revoked synthetic verifier',
    array['program'],
    'revoked',
    '2027-01-15 12:00:00+00',
    '2026-07-10 12:00:00+00',
    '2026-07-01 12:00:00+00',
    '2026-07-10 12:00:00+00',
    '00000000-0000-4000-8000-000000000101'
  );

insert into public.integration_capabilities (
  id,
  institution_id,
  provider,
  state,
  detail
)
values
  ('78000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'world', 'not-configured', 'World verification credentials are not configured.'),
  ('78000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'world-chain', 'not-configured', 'World Chain Sepolia signer and RPC are not configured.'),
  ('78000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'ens', 'not-configured', 'Ethereum Sepolia ENS parent is not configured.'),
  ('78000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'zero-g', 'not-configured', '0G Compute Router credentials are not configured.'),
  ('78000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'walletconnect', 'not-configured', 'WalletConnect project ID is not configured.');

insert into public.audit_events (
  id,
  institution_id,
  actor_user_id,
  action,
  entity_type,
  entity_id,
  outcome,
  metadata,
  occurred_at
)
values
  ('79000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'academic_record.published', 'academic_record_version', '73000000-0000-4000-8000-000000000001', 'success', '{"synthetic":true}', '2026-05-21 11:05:00+00'),
  ('79000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'enrollment.created', 'enrollment', '70000000-0000-4000-8000-000000000001', 'success', '{"synthetic":true}', '2026-04-03 14:20:00+00');
