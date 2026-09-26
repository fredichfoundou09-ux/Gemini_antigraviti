-- ============================================================
-- 0052_sentinel_ai_vector_and_streaming.sql
-- Extension pgvector, recherche documentaire multi-termes & sémantique,
-- et marquage des messages envoyés par l'IA (SENT BY AI)
-- ============================================================

-- 1. Activation sécurisée de l'extension pgvector
create extension if not exists vector;

-- 2. Ajout de la colonne embedding vectoriel aux fragments documentaires
alter table public.ai_document_chunks
  add column if not exists embedding vector(1024);

-- Index HNSW ou IVFFLAT pour la recherche vectorielle rapide par similarité cosinus
create index if not exists idx_ai_chunks_embedding
  on public.ai_document_chunks using hnsw (embedding vector_cosine_ops);

-- 3. Fonction RPC de recherche vectorielle par similarité cosinus
create or replace function public.match_document_chunks (
  query_embedding vector(1024),
  match_count int default 8,
  filter_roles text[] default null
)
returns table (
  id uuid,
  document_title text,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
security invoker
as $$
begin
  return query
  select
    c.id,
    c.document_title,
    c.content,
    c.metadata,
    (1 - (c.embedding <=> query_embedding))::float as similarity
  from public.ai_document_chunks c
  where c.active = true
    and (c.embedding is not null)
    and (filter_roles is null or c.target_roles && filter_roles or public.is_staff())
  order by c.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- 4. Fonction RPC de recherche plein-texte multi-termes pondérée (fallback et hybride)
create or replace function public.search_document_chunks_multiterm (
  search_terms text[],
  match_count int default 10,
  filter_roles text[] default null
)
returns table (
  id uuid,
  document_title text,
  content text,
  metadata jsonb,
  rank float
)
language plpgsql
security invoker
as $$
declare
  terms_formatted text;
  query_ts tsquery;
begin
  select string_agg(quote_literal(t) || ':*', ' | ') into terms_formatted
  from unnest(search_terms) as t
  where length(t) >= 2;

  if terms_formatted is null or terms_formatted = '' then
    return query
    select c.id, c.document_title, c.content, c.metadata, 1.0::float as rank
    from public.ai_document_chunks c
    where c.active = true
      and (filter_roles is null or c.target_roles && filter_roles or public.is_staff())
    order by c.created_at desc
    limit match_count;
    return;
  end if;

  query_ts := to_tsquery('french', terms_formatted);

  return query
  select
    c.id,
    c.document_title,
    c.content,
    c.metadata,
    ts_rank(to_tsvector('french', c.document_title || ' ' || c.content), query_ts)::float as rank
  from public.ai_document_chunks c
  where c.active = true
    and (filter_roles is null or c.target_roles && filter_roles or public.is_staff())
    and to_tsvector('french', c.document_title || ' ' || c.content) @@ query_ts
  order by rank desc
  limit match_count;
end;
$$;

grant execute on function public.match_document_chunks to authenticated;
grant execute on function public.search_document_chunks_multiterm to authenticated;

-- 5. Traçabilité des messages émis par l'IA dans la messagerie interne
alter table public.messages
  add column if not exists sent_by_ai boolean not null default false;

create index if not exists idx_messages_sent_by_ai on public.messages (sent_by_ai);
