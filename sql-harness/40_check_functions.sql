-- Vérifie statiquement TOUTES les fonctions PL/pgSQL contre le schéma réellement créé par les migrations.
create extension if not exists plpgsql_check;
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
select p.proname, c.message
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
join pg_language l on l.oid = p.prolang and l.lanname = 'plpgsql'
cross join lateral plpgsql_check_function_tb(p.oid, fatal_errors => false, other_warnings => false,
                                             performance_warnings => false, extra_warnings => false) c
where c.level = 'error' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype
order by p.proname;
