do $$
declare
  relation_name text;
  definition text;
  mojibake_dash text :=
    convert_from(decode('c3a2e282ace2809c', 'hex'), 'UTF8');
  mojibake_bullet text :=
    convert_from(decode('c382c2b7', 'hex'), 'UTF8');
begin
  foreach relation_name in array array[
    'instructor_assigned_sections',
    'instructor_section_gradebook'
  ]
  loop
    definition := pg_get_viewdef(
      format('public.%I', relation_name)::regclass,
      true
    );
    definition := replace(definition, mojibake_dash, chr(8211));
    definition := replace(definition, mojibake_bullet, chr(183));

    execute format(
      'create or replace view public.%I with (security_invoker = true) as %s',
      relation_name,
      definition
    );
  end loop;
end;
$$;
