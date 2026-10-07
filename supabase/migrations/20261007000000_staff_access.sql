-- Staff access switches. The owner turns each locked section on or off for
-- all staff in Settings. Everything starts off. Only the owner can manage
-- staff, change settings, delete products or delete expenses.
--
--   summary   : Night summary (shows profit)
--   reports   : Reports (shows profit)
--   suppliers : Suppliers, purchases and supplier payments
--   expenses  : Expenses and today's closing
--   costs     : Buying prices and profit per item
--   cancel    : Cancel bills

alter table public.shop_settings
  add column staff_access text[] not null default '{}'
  check (staff_access <@ array['summary', 'reports', 'suppliers', 'expenses', 'costs', 'cancel']);

alter table public.shop_expenses add column created_by text not null default public.shop_email();
alter table public.shop_purchases add column created_by text not null default public.shop_email();
alter table public.shop_supplier_payments add column created_by text not null default public.shop_email();

-- True for the owner, and for staff when the owner switched this section on.
create function public.shop_can(p_area text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.shop_is_owner()
    or (public.shop_is_member()
      and exists (select 1 from public.shop_settings where id = 1 and p_area = any(staff_access)));
$$;

-- Staff read and add (never edit or delete) when allowed. The owner's
-- existing "manage" policies still cover everything for the owner.
create policy "Staff read buying prices when allowed" on public.shop_product_costs
  for select to authenticated using ((select public.shop_can('costs')));
create policy "Staff read buying price history when allowed" on public.shop_cost_history
  for select to authenticated using ((select public.shop_can('costs')));
create policy "Staff read sold item costs when allowed" on public.shop_bill_item_costs
  for select to authenticated using ((select public.shop_can('costs')));

create policy "Staff read suppliers when allowed" on public.shop_suppliers
  for select to authenticated using ((select public.shop_can('suppliers')));
create policy "Staff add suppliers when allowed" on public.shop_suppliers
  for insert to authenticated with check ((select public.shop_can('suppliers')));
create policy "Staff read purchases when allowed" on public.shop_purchases
  for select to authenticated using ((select public.shop_can('suppliers')));
create policy "Staff add purchases when allowed" on public.shop_purchases
  for insert to authenticated
  with check ((select public.shop_can('suppliers')) and created_by = (select public.shop_email()));
create policy "Staff read supplier payments when allowed" on public.shop_supplier_payments
  for select to authenticated using ((select public.shop_can('suppliers')));
create policy "Staff add supplier payments when allowed" on public.shop_supplier_payments
  for insert to authenticated
  with check ((select public.shop_can('suppliers')) and created_by = (select public.shop_email()));

create policy "Staff read expenses when allowed" on public.shop_expenses
  for select to authenticated using ((select public.shop_can('expenses')));
create policy "Staff add expenses when allowed" on public.shop_expenses
  for insert to authenticated
  with check ((select public.shop_can('expenses')) and created_by = (select public.shop_email()));

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
  if not public.shop_can('expenses') then
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

-- The functions below are unchanged except for who may use them.

create or replace function public.shop_set_cost(p_product uuid, p_cost numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.shop_can('costs') then
    raise exception 'Only the owner can set buying prices';
  end if;
  if p_cost is null or p_cost < 0 then
    raise exception 'Buying price cannot be negative';
  end if;
  if exists (select 1 from public.shop_product_costs where product_id = p_product and cost = p_cost) then
    return;
  end if;
  insert into public.shop_product_costs (product_id, cost, updated_at)
  values (p_product, p_cost, now())
  on conflict (product_id) do update set cost = excluded.cost, updated_at = now();
  insert into public.shop_cost_history (product_id, cost) values (p_product, p_cost);
end;
$$;

create or replace function public.shop_save_product(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_qty integer := greatest(0, coalesce(nullif(p ->> 'qty', '')::integer, 0));
begin
  if not public.shop_is_member() then
    raise exception 'You are not part of this shop';
  end if;
  if coalesce(trim(p ->> 'name'), '') = '' then
    raise exception 'Product name is needed';
  end if;

  if v_id is null then
    insert into public.shop_products (name, category_id, brand, code, price, qty, reorder_level, warranty_months, fits)
    values (
      trim(p ->> 'name'),
      nullif(p ->> 'category_id', '')::bigint,
      coalesce(trim(p ->> 'brand'), ''),
      coalesce(trim(p ->> 'code'), ''),
      coalesce(nullif(p ->> 'price', '')::numeric, 0),
      v_qty,
      coalesce(nullif(p ->> 'reorder_level', '')::integer, 3),
      coalesce(nullif(p ->> 'warranty_months', '')::integer, 0),
      coalesce(trim(p ->> 'fits'), '')
    )
    returning id into v_id;
    insert into public.shop_stock_moves (product_id, kind, change, qty_after, note)
    values (v_id, 'opening', v_qty, v_qty, coalesce(p ->> 'note', ''));
  else
    update public.shop_products set
      name = trim(p ->> 'name'),
      category_id = nullif(p ->> 'category_id', '')::bigint,
      brand = coalesce(trim(p ->> 'brand'), ''),
      code = coalesce(trim(p ->> 'code'), ''),
      price = coalesce(nullif(p ->> 'price', '')::numeric, 0),
      reorder_level = coalesce(nullif(p ->> 'reorder_level', '')::integer, 3),
      warranty_months = coalesce(nullif(p ->> 'warranty_months', '')::integer, 0),
      fits = coalesce(trim(p ->> 'fits'), '')
    where id = v_id and active;
    if not found then
      raise exception 'Product not found';
    end if;
  end if;

  if public.shop_can('costs') and nullif(p ->> 'cost', '') is not null then
    perform public.shop_set_cost(v_id, (p ->> 'cost')::numeric);
  end if;

  return v_id;
end;
$$;

create or replace function public.shop_receive_stock(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  q integer;
  total integer := 0;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'Expected a list of products';
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    q := nullif(r ->> 'qty', '')::integer;
    if q is null or q <= 0 then
      continue;
    end if;
    perform public.shop_adjust_stock((r ->> 'product_id')::uuid, 'delivery', q, coalesce(r ->> 'note', ''));
    if public.shop_can('costs') and nullif(r ->> 'cost', '') is not null then
      perform public.shop_set_cost((r ->> 'product_id')::uuid, (r ->> 'cost')::numeric);
    end if;
    total := total + q;
  end loop;
  if total = 0 then
    raise exception 'Type how many arrived';
  end if;
  return total;
end;
$$;

create or replace function public.shop_cancel_bill(p_bill uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.shop_bills;
  it record;
  cur integer;
begin
  if not public.shop_can('cancel') then
    raise exception 'Only the owner can cancel a bill';
  end if;
  select * into b from public.shop_bills where id = p_bill for update;
  if not found then
    raise exception 'Bill not found';
  end if;
  if b.cancelled then
    raise exception 'This bill is already cancelled';
  end if;

  for it in
    select product_id, qty from public.shop_bill_items
    where bill_id = p_bill and product_id is not null
  loop
    select qty into cur from public.shop_products where id = it.product_id for update;
    if found then
      update public.shop_products set qty = cur + it.qty where id = it.product_id;
      insert into public.shop_stock_moves (product_id, kind, change, qty_after, note)
      values (it.product_id, 'cancel', it.qty, cur + it.qty, 'Bill B-' || b.no || ' cancelled');
    end if;
  end loop;

  update public.shop_bills set cancelled = true where id = p_bill;
end;
$$;

create or replace function public.shop_report(p_from timestamptz, p_to timestamptz, p_buckets timestamptz[] default '{}')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not (public.shop_can('reports') or public.shop_can('summary')) then
    raise exception 'Only the owner can see reports';
  end if;

  with
  b as (
    select * from public.shop_bills
    where not cancelled and created_at >= p_from and created_at < p_to
  ),
  it as (
    select i.product_id, i.name, i.qty, i.price, coalesce(c.cost, 0) as cost
    from public.shop_bill_items i
    join b on b.id = i.bill_id
    left join public.shop_bill_item_costs c on c.item_id = i.id
  ),
  pay as (
    select * from public.shop_payments where created_at >= p_from and created_at < p_to
  ),
  ex as (
    select * from public.shop_expenses where created_at >= p_from and created_at < p_to
  ),
  pur as (
    select * from public.shop_purchases where created_at >= p_from and created_at < p_to
  ),
  sp as (
    select * from public.shop_supplier_payments where created_at >= p_from and created_at < p_to
  ),
  modes as (
    select m.mode,
      coalesce((select sum(case m.mode when 'cash' then paid_cash when 'upi' then paid_upi else paid_card end) from b), 0)
      + coalesce((select sum(amount) from pay where pay.mode = m.mode), 0)
      - coalesce((select sum(amount) from ex where ex.mode = m.mode), 0)
      - coalesce((select sum(paid) from pur where pur.mode = m.mode), 0)
      - coalesce((select sum(amount) from sp where sp.mode = m.mode), 0) as net
    from (values ('cash'), ('upi'), ('card')) as m(mode)
  ),
  per_product as (
    select
      it.product_id,
      coalesce(max(pr.name), max(it.name)) as name,
      max(c.name) as category,
      sum(it.qty) as qty,
      sum(it.qty * it.price) as sales,
      sum(it.qty * (it.price - it.cost)) as profit
    from it
    left join public.shop_products pr on pr.id = it.product_id
    left join public.shop_categories c on c.id = pr.category_id
    group by it.product_id
  )
  select jsonb_build_object(
    'sales', coalesce((select sum(total) from b), 0),
    'bills', (select count(*) from b),
    'cash', coalesce((select sum(paid_cash) from b), 0),
    'upi', coalesce((select sum(paid_upi) from b), 0),
    'card', coalesce((select sum(paid_card) from b), 0),
    'later', coalesce((select sum(due) from b), 0),
    'items', coalesce((select sum(qty) from it where product_id is not null), 0),
    'profit', coalesce((select sum(qty * (price - cost)) from it), 0),
    'expenses', coalesce((select sum(amount) from ex), 0),
    'received', coalesce((select sum(amount) from pay), 0),
    'stock_in', coalesce((
      select sum(change) from public.shop_stock_moves
      where created_at >= p_from and created_at < p_to and kind in ('opening', 'delivery') and change > 0
    ), 0),
    'drawer', (select jsonb_object_agg(mode, net) from modes),
    'buckets', (
      select coalesce(jsonb_agg(coalesce(s.v, 0) order by g.i), '[]'::jsonb)
      from generate_subscripts(p_buckets, 1) as g(i)
      left join lateral (
        select sum(total) as v from b
        where created_at >= p_buckets[g.i] and created_at < coalesce(p_buckets[g.i + 1], p_to)
      ) s on true
    ),
    'products', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.profit desc), '[]'::jsonb)
      from per_product x
    )
  )
  into result;

  return result;
end;
$$;

revoke execute on function public.shop_can(text), public.shop_drawer(timestamptz, timestamptz) from public, anon;
grant execute on function public.shop_can(text), public.shop_drawer(timestamptz, timestamptz) to authenticated;
