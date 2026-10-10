\set ON_ERROR_STOP 0
\echo '=== TEST RLS : connecté en tant qu''APPRENANT (eleve1) ==='
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false);
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000c1"}',false);
\echo '-- lire les clés API :'
select name, key_prefix, key_hash from public.api_keys;
\echo '-- lire le secret de webhook :'
select secret from public.webhook_endpoints;
\echo '-- lire les réponses « anonymes » aux enquêtes :'
select respondent_hash from public.survey_responses;
\echo '-- lire les tuteurs :'
select nom, prenom from public.guardians;
\echo '-- modifier un badge officiel :'
update public.badges set name='HACKÉ' where id='b1' returning id, name;
\echo '-- s''attribuer une compétence :'
insert into public.student_competency_progress(student_id, competency_id) values ('S1','c1') returning student_id, competency_id;
\echo '-- supprimer un tuteur :'
delete from public.guardians returning nom;
reset role;
\echo ''
\echo '=== TEST RLS : utilisateur NON connecté (anon) ==='
set role anon;
select count(*) as cles_api_visibles from public.api_keys;
reset role;
\echo ''
\echo '=== TEST : corrections attendues (administrateur) ==='
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a1"}',false);
select count(*) as cles_api_vues_par_admin from public.api_keys;
reset role;
