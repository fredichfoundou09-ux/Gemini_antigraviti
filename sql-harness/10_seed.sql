\set ON_ERROR_STOP 0
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-0000000000a1','admin@t.cg'),
 ('00000000-0000-0000-0000-0000000000b1','prof@t.cg'),
 ('00000000-0000-0000-0000-0000000000c1','eleve1@t.cg'),
 ('00000000-0000-0000-0000-0000000000c2','eleve2@t.cg') on conflict do nothing;
insert into public.profiles(id,username,name,email,role) values
 ('00000000-0000-0000-0000-0000000000a1','admin','Admin','admin@t.cg','admin'),
 ('00000000-0000-0000-0000-0000000000b1','prof','Prof','prof@t.cg','teacher'),
 ('00000000-0000-0000-0000-0000000000c1','eleve1','Eleve Un','eleve1@t.cg','student'),
 ('00000000-0000-0000-0000-0000000000c2','eleve2','Eleve Deux','eleve2@t.cg','student')
 on conflict (id) do update set role=excluded.role, username=excluded.username, name=excluded.name;
insert into public.formations(id,code,name) values ('11111111-1111-1111-1111-111111111111','F1','Formation 1') on conflict do nothing;
insert into public.modules(id,formation_id,numero,titre) values ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111',1,'Module 1') on conflict do nothing;
insert into public.teachers(id,user_id,nom,prenom,specialite,email,phone) values ('T1','00000000-0000-0000-0000-0000000000b1','Prof','Un','Info','prof@t.cg','000') on conflict do nothing;
insert into public.students(id,user_id,formation_id,nom,prenom) values
 ('S1','00000000-0000-0000-0000-0000000000c1','11111111-1111-1111-1111-111111111111','Un','Eleve'),
 ('S2','00000000-0000-0000-0000-0000000000c2','11111111-1111-1111-1111-111111111111','Deux','Eleve') on conflict do nothing;
-- données sensibles à protéger
insert into public.api_keys(name,key_hash,key_prefix) values ('cle-prod','hash_secret','sk_live_ab');
insert into public.webhook_endpoints(url,secret) values ('https://exemple.cg/hook','whsec_TRESSECRET');
insert into public.guardians(nom,prenom) values ('Parent','Un');
insert into public.badges(id,name) values ('b1','Badge officiel');
insert into public.surveys(id,title) values ('33333333-3333-3333-3333-333333333333','Enquête qualité');
insert into public.survey_questions(id,survey_id,question_text) values ('44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-333333333333','Satisfaction ?');
insert into public.survey_responses(survey_id,question_id,respondent_hash) values ('33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444','hash_de_S2');
insert into public.competencies(id,code,nom,domaine) values ('c1','C1','Compétence 1','Info');
select 'seed ok: ' || (select count(*) from public.students) || ' élèves';
