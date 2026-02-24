-- Upgrade Mira memory embedding vectors to 3072 dimensions.
-- Existing 768-d embeddings cannot be cast losslessly to 3072-d, so they are reset
-- and should be regenerated lazily on future remember/update flows.
alter table public.mira_memories
alter column embedding type extensions.vector(3072) using null;

drop function if exists public.match_memories(extensions.vector(768), int, text);
drop function if exists public.match_memories(extensions.vector(3072), int, text);

create function public.match_memories(
  query_embedding extensions.vector(3072),
  match_count int default 10,
  filter_category text default null
) returns table (
  id uuid,
  key text,
  value text,
  category public.mira_memory_category,
  similarity float
) language plpgsql as $$
begin
  return query
  select
    mira_memories.id,
    mira_memories.key,
    mira_memories.value,
    mira_memories.category,
    1 - (mira_memories.embedding <=> query_embedding) as similarity
  from mira_memories
  where
    (filter_category is null or mira_memories.category::text = filter_category)
    and mira_memories.embedding is not null
    -- Ensure user can only search their own memories via RLS-scoped uid.
    and auth.uid() = mira_memories.user_id
  order by mira_memories.embedding <=> query_embedding
  limit match_count;
end;
$$;
