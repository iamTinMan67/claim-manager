-- Create secure RPC to update subscribers, owner-only
create or replace function public.admin_set_subscription(
  target_user_id uuid,
  p_subscribed boolean,
  p_tier text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id constant uuid := 'f41fbcf1-c378-4594-9a46-fdc198c1a38a';
  tier_normalized text := lower(coalesce(p_tier, 'free'));
begin
  -- authorize: only owner can call
  if auth.uid() is distinct from owner_id then
    raise exception 'Not authorized';
  end if;

  -- normalize tier
  if tier_normalized not in ('free','basic','general','premium') then
    tier_normalized := 'free';
  end if;

  -- upsert subscribers row
  insert into public.subscribers (user_id, subscribed, subscription_tier)
  values (target_user_id, p_subscribed, tier_normalized)
  on conflict (user_id)
  do update set subscribed = excluded.subscribed, subscription_tier = excluded.subscription_tier, updated_at = now();
end;
$$;

-- Optional: allow authenticated users to call; function enforces owner check internally
grant execute on function public.admin_set_subscription(uuid, boolean, text) to authenticated;

