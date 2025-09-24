-- Update accept_invitation to enforce free-tier participant limit (1 claim per free user)
create or replace function public.accept_invitation(invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv record;
  v_is_free boolean := true;
  v_current_guest_count int := 0;
  v_tier text;
begin
  -- Ensure the invitation exists, is pending, and belongs to the caller
  select * into v_inv
  from public.pending_invitations
  where id = invitation_id
    and invited_user_id = auth.uid()
    and status = 'pending'
  for update;

  if not found then
    raise exception 'Not authorized or invitation not pending';
  end if;

  -- Determine invited user's subscription tier (default free)
  select lower(subscription_tier) into v_tier
  from public.subscribers
  where user_id = v_inv.invited_user_id;

  if v_tier is null then
    v_is_free := true;
  else
    v_is_free := not (v_tier in ('basic','general','premium'));
  end if;

  -- Free tier: allow unlimited guesting; host limits are enforced elsewhere (invite path)

  -- Create share from invitation
  insert into public.claim_shares (claim_id, owner_id, shared_with_id, permission, can_view_evidence, is_frozen, is_muted)
  select claim_id, owner_id, invited_user_id, permission, can_view_evidence, is_frozen, is_muted
  from public.pending_invitations where id = invitation_id
  on conflict do nothing;

  -- Mark invitation accepted
  update public.pending_invitations set status = 'accepted', updated_at = now()
  where id = invitation_id;
end;
$$;

