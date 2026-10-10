\set ON_ERROR_STOP 0
\set a1 '00000000-0000-0000-0000-0000000000a1'
\set b1 '00000000-0000-0000-0000-0000000000b1'
\set c1 '00000000-0000-0000-0000-0000000000c1'
\set c2 '00000000-0000-0000-0000-0000000000c2'
reset role;
insert into public.tests(id,titre,module_id,teacher_id,statut,tentatives,date_debut,date_fin,duree)
 values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Évaluation test','22222222-2222-2222-2222-222222222222','T1','publie',1,now()-interval '1 hour',now()+interval '1 day',45) on conflict do nothing;
insert into public.questions(test_id,question,type,bonne_reponse) values
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Capitale du Congo ?','qcm','Brazzaville'),
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','2+2 ?','qcm','4');
select id as q1 from public.questions where question like 'Capitale%' \gset
select id as q2 from public.questions where question like '2+2%' \gset
select format('{"%s":"Brazzaville","%s":"5"}', :'q1', :'q2') as ans \gset

\echo '##### 1. APPRENANT : peut-il lire les bonnes réponses ?'
set role authenticated; select set_config('request.jwt.claims', format('{"role":"authenticated","sub":"%s"}', :'c1'), false) \gset
select set_config('request.jwt.claim.sub', :'c1', false) \gset
select question, bonne_reponse from public.questions where test_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

\echo '##### 2. APPRENANT : démarrer puis soumettre (2 questions, 1 juste)'
select public.start_assessment_attempt('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') as start_res \gset
select :'start_res'::jsonb ->> 'attempt_id' as att \gset
select :'start_res'::jsonb as demarrage;
select public.submit_assessment(:'att'::uuid, :'ans'::jsonb) as submit_res \gset
select :'submit_res'::jsonb as soumission;
\echo '-- seconde soumission (doit être refusée proprement) :'
select public.submit_assessment(:'att'::uuid, :'ans'::jsonb);
\echo '-- nouvelle tentative (limite = 1) :'
select public.start_assessment_attempt('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
\echo '-- résultats visibles par S1 :'
select count(*) from public.test_results;
reset role;

\echo '##### 3. AUTRE APPRENANT (S2) : voit-il le résultat de S1 ?'
set role authenticated; select set_config('request.jwt.claim.sub', :'c2', false) \gset
select set_config('request.jwt.claims', format('{"role":"authenticated","sub":"%s"}', :'c2'), false) \gset
select count(*) as resultats_vus_par_S2 from public.test_results;
reset role;

\echo '##### 4. FORMATEUR : voit le résultat, le corrige manuellement'
set role authenticated; select set_config('request.jwt.claim.sub', :'b1', false) \gset
select set_config('request.jwt.claims', format('{"role":"authenticated","sub":"%s"}', :'b1'), false) \gset
select count(*) as resultats_vus_par_formateur from public.test_results;
select id as rid from public.test_results limit 1 \gset
select public.grade_test_result(:'rid'::uuid, format('{"%s":5,"%s":5}', :'q1', :'q2')::jsonb, '{}'::jsonb) as grade_res;
select note, statut, valide from public.test_results where id=:'rid'::uuid;
\echo '-- report de note au bulletin (upsert_grade_safe) :'
select public.upsert_grade_safe('S1','22222222-2222-2222-2222-222222222222'::uuid, 12, 'ok');
reset role;
