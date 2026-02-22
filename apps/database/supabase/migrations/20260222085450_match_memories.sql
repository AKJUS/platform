create or replace function match_memories(
  query_embedding vector(768),
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
    -- ensure user can only search their own memories by restricting via RLS
    and auth.uid() = mira_memories.user_id
  order by mira_memories.embedding <=> query_embedding
  limit match_count;
end;
$$;
