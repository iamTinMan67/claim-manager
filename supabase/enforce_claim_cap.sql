-- Enforce host claim cap (2 claims per user across all tiers)
create or replace function public.enforce_claim_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if NEW.user_id is null then
    raise exception 'CLAIM_LIMIT: Missing user_id on claim insert';
  end if;

  select count(*) into v_count from public.claims where user_id = NEW.user_id;
  if v_count >= 2 then
    raise exception 'CLAIM_LIMIT: You can host at most 2 claims on your plan';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_enforce_claim_cap on public.claims;
create trigger trg_enforce_claim_cap
before insert on public.claims
for each row
execute function public.enforce_claim_cap();

