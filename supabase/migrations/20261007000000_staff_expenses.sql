-- Let the owner allow staff to add expenses and see today's closing.
-- Off by default. Staff never delete expenses, and still never see
-- buying prices, profit, reports or suppliers.

alter table public.shop_settings
  add column staff_expenses boolean not null default false;

alter table public.shop_expenses
  add column created_by text not null default public.shop_email();

create function public.shop_can_expense()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.shop_is_owner()
    or (public.shop_is_member() and coalesce((select staff_expenses from public.shop_settings where id = 1), false));
$$;

create policy "Staff read expenses when allowed" on public.shop_expenses
  for select to authenticated using ((select public.shop_can_expense()));
create policy "Staff add expenses when allowed" on public.shop_expenses
  for insert to authenticated
  with check ((select public.shop_can_expense()) and created_by = (select public.shop_email()));

-- Money in minus money out for [p_from, p_to), per payment mode.
create function public.shop_drawer(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.shop_can_expense() then
    raise exception 'Only the owner can see the closing';
  end if;

  select jsonb_object_agg(m.mode,
    coalesce((
      select sum(case m.mode when 'cash' then paid_cash when 'upi' then paid_upi else paid_card end)
      from public.shop_bills where not cancelled and created_at >= p_from and created_at < p_to
    ), 0)
    + coalesce((select sum(amount) from public.shop_payments
      where mode = m.mode and created_at >= p_from and created_at < p_to), 0)
    - coalesce((select sum(amount) from public.shop_expenses
      where mode = m.mode and created_at >= p_from and created_at < p_to), 0)
    - coalesce((select sum(paid) from public.shop_purchases
      where mode = m.mode and created_at >= p_from and created_at < p_to), 0)
    - coalesce((select sum(amount) from public.shop_supplier_payments
      where mode = m.mode and created_at >= p_from and created_at < p_to), 0))
  into result
  from (values ('cash'), ('upi'), ('card')) as m(mode);

  return result;
end;
$$;

revoke execute on function public.shop_can_expense(), public.shop_drawer(timestamptz, timestamptz) from public, anon;
grant execute on function public.shop_can_expense(), public.shop_drawer(timestamptz, timestamptz) to authenticated;
