do $migration$
declare
  function_definition text;
  ambiguous_conflict_target constant text :=
    'on conflict (student_id, section_id) do update';
  qualified_conflict_target constant text :=
    'on conflict on constraint enrollments_student_id_section_id_key do update';
begin
  select pg_get_functiondef(
    'public.register_for_sections(uuid[],uuid)'::regprocedure
  )
  into function_definition;

  if position(ambiguous_conflict_target in function_definition) = 0 then
    raise exception
      'Expected registration enrollment conflict target was not found';
  end if;

  execute replace(
    function_definition,
    ambiguous_conflict_target,
    qualified_conflict_target
  );
end;
$migration$;

comment on function public.register_for_sections(uuid[], uuid)
is 'Atomically registers the authenticated student for a bounded section set with locked capacity, constraint-qualified upserts, and idempotent replay.';
