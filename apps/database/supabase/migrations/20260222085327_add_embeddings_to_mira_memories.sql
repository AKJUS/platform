-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector
with
  schema extensions;

-- Add tracking for the embeddings model version (e.g. text-embedding-004)
alter table public.mira_memories
add column embedding extensions.vector(768);

-- Optionally down the road, creating an index for similarity search
-- create index on public.mira_memories using hnsw (embedding vector_ip_ops);
