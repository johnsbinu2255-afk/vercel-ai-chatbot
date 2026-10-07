import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

import type {
  Bill,
  Cart,
  Category,
  Customer,
  Due,
  Expense,
  Job,
  Me,
  Member,
  PayMode,
  Product,
  Purchase,
  Quote,
  Report,
  Settings,
  StockMove,
  Supplier
} from '@/lib/shop/types'

export function supabase() {
  return createClientComponentClient()
}

/** Turns a Supabase error into a thrown Error with a message people can read. */
function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

const toNum = (v: unknown) => Number(v) || 0

function normalizeBill(b: any): Bill {
  return {
    ...b,
    total: toNum(b.total),
    paid_cash: toNum(b.paid_cash),
    paid_upi: toNum(b.paid_upi),
    paid_card: toNum(b.paid_card),
    due: toNum(b.due),
    items: (b.items ?? [])
      .map((i: any) => ({ ...i, price: toNum(i.price), qty: toNum(i.qty) }))
      .sort((a: any, z: any) => a.id - z.id)
  }
}

const normalizeProduct = (p: any): Product => ({ ...p, price: toNum(p.price) })

// ---------------------------------------------------------------------------
// Session and shop data
// ---------------------------------------------------------------------------

export async function loadMe(): Promise<Me> {
  const me: any = check(await supabase().rpc('shop_me'))
  return { email: me.email, role: me.role, hasOwner: !!me.has_owner }
}

export async function claimOwner(shopName: string) {
  check(await supabase().rpc('shop_claim_owner'))
  if (shopName.trim()) {
    check(await supabase().from('shop_settings').update({ name: shopName.trim() }).eq('id', 1))
  }
}

export async function signOut() {
  await supabase().auth.signOut()
}

export interface ShopData {
  settings: Settings
  categories: Category[]
  products: Product[]
  costs: Record<string, number>
  customers: Customer[]
  dues: Record<string, Due>
  jobs: Job[]
  quotes: Quote[]
  bills: Bill[]
}

export async function loadShop(isOwner: boolean): Promise<ShopData> {
  const sb = supabase()
  const [settings, categories, products, customers, dues, jobs, quotes, bills, costs] =
    await Promise.all([
      sb.from('shop_settings').select('*').eq('id', 1).single(),
      sb.from('shop_categories').select('*').order('sort_order').order('name'),
      sb.from('shop_products').select('*').eq('active', true).order('name'),
      sb.from('shop_customers').select('*').order('name'),
      sb.from('shop_customer_dues').select('*'),
      sb.from('shop_jobs').select('*').neq('status', 'billed').order('created_at', { ascending: false }),
      sb.from('shop_quotes').select('*').order('created_at', { ascending: false }).limit(50),
      sb
        .from('shop_bills')
        .select('*, items:shop_bill_items(*)')
        .order('created_at', { ascending: false })
        .limit(200),
      isOwner
        ? sb.from('shop_product_costs').select('product_id, cost')
        : Promise.resolve({ data: [] as any[], error: null })
    ])
  const dueMap: Record<string, Due> = {}
  for (const d of check(dues) as any[]) {
    dueMap[d.customer_id] = { ...d, due: toNum(d.due) }
  }
  const costMap: Record<string, number> = {}
  for (const c of check(costs) as any[]) costMap[c.product_id] = toNum(c.cost)
  return {
    settings: check(settings) as Settings,
    categories: check(categories) as Category[],
    products: (check(products) as any[]).map(normalizeProduct),
    costs: costMap,
    customers: (check(customers) as any[]).map(c => ({ ...c, cars: Array.isArray(c.cars) ? c.cars : [] })),
    dues: dueMap,
    jobs: (check(jobs) as any[]).map(j => ({ ...j, labour: toNum(j.labour) })),
    quotes: (check(quotes) as any[]).map(q => ({ ...q, total: toNum(q.total) })),
    bills: (check(bills) as any[]).map(normalizeBill)
  }
}

// ---------------------------------------------------------------------------
// Bills
// ---------------------------------------------------------------------------

export async function createBill(cart: Cart): Promise<string> {
  const total = cart.lines.reduce((s, l) => s + l.qty * l.price, 0)
  const pay = { cash: 0, upi: 0, card: 0 }
  if (cart.mode === 'later') pay.cash = Math.min(total, Math.max(0, cart.paidNow))
  else pay[cart.mode] = total
  const id = check(
    await supabase().rpc('shop_create_bill', {
      p: {
        customer_id: cart.customerId,
        job_id: cart.jobId,
        quote_id: cart.quoteId,
        ...pay,
        items: cart.lines.map(l => ({
          product_id: l.product_id,
          name: l.name,
          qty: l.qty,
          price: l.price,
          serial: l.serial
        }))
      }
    })
  )
  return id as unknown as string
}

export async function getBill(id: string): Promise<Bill | null> {
  const data = check(
    await supabase().from('shop_bills').select('*, items:shop_bill_items(*)').eq('id', id).maybeSingle()
  )
  return data ? normalizeBill(data) : null
}

export async function customerBills(customerId: string): Promise<Bill[]> {
  const data = check(
    await supabase()
      .from('shop_bills')
      .select('*, items:shop_bill_items(*)')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
  ) as any[]
  return data.map(normalizeBill)
}

export async function olderBills(before: string, limit = 100): Promise<Bill[]> {
  const data = check(
    await supabase()
      .from('shop_bills')
      .select('*, items:shop_bill_items(*)')
      .lt('created_at', before)
      .order('created_at', { ascending: false })
      .limit(limit)
  ) as any[]
  return data.map(normalizeBill)
}

export async function cancelBill(id: string) {
  check(await supabase().rpc('shop_cancel_bill', { p_bill: id }))
}

// ---------------------------------------------------------------------------
// Products and stock
// ---------------------------------------------------------------------------

export interface ProductInput {
  id?: string
  name: string
  category_id: number | null
  brand?: string
  code?: string
  price: number
  qty?: number
  reorder_level?: number
  warranty_months?: number
  fits?: string
  cost?: number | null
}

function productPayload(p: ProductInput) {
  return {
    ...p,
    category_id: p.category_id ?? '',
    cost: p.cost === null || p.cost === undefined ? '' : p.cost
  }
}

export async function saveProduct(p: ProductInput): Promise<string> {
  return check(await supabase().rpc('shop_save_product', { p: productPayload(p) })) as unknown as string
}

export async function addProducts(rows: ProductInput[]): Promise<number> {
  return check(
    await supabase().rpc('shop_add_products', { p_rows: rows.map(productPayload) })
  ) as unknown as number
}

export async function deleteProduct(id: string) {
  check(await supabase().rpc('shop_delete_product', { p_product: id }))
}

export async function adjustStock(
  id: string,
  kind: 'delivery' | 'count' | 'return' | 'damaged',
  qty: number,
  note: string
) {
  check(
    await supabase().rpc('shop_adjust_stock', {
      p_product: id,
      p_kind: kind,
      p_qty: qty,
      p_note: note
    })
  )
}

export async function receiveStock(rows: { product_id: string; qty: number; cost?: number | null }[]) {
  return check(
    await supabase().rpc('shop_receive_stock', {
      p_rows: rows.map(r => ({ ...r, cost: r.cost ?? '' }))
    })
  ) as unknown as number
}

export async function productMoves(id: string): Promise<StockMove[]> {
  return check(
    await supabase()
      .from('shop_stock_moves')
      .select('*')
      .eq('product_id', id)
      .order('created_at', { ascending: false })
      .limit(30)
  ) as StockMove[]
}

export async function costHistory(id: string): Promise<{ cost: number; created_at: string }[]> {
  const data = check(
    await supabase()
      .from('shop_cost_history')
      .select('cost, created_at')
      .eq('product_id', id)
      .order('created_at', { ascending: false })
      .limit(10)
  ) as any[]
  return data.map(c => ({ ...c, cost: toNum(c.cost) }))
}

export async function addCategory(name: string, sortOrder: number) {
  check(await supabase().from('shop_categories').insert({ name: name.trim(), sort_order: sortOrder }))
}

// ---------------------------------------------------------------------------
// Customers, udhaar, jobs and quotations
// ---------------------------------------------------------------------------

export async function addCustomer(c: { name: string; phone: string; cars: { no: string; model: string }[] }) {
  return check(
    await supabase().from('shop_customers').insert(c).select().single()
  ) as Customer
}

export async function updateCustomer(id: string, patch: Partial<Customer>) {
  check(await supabase().from('shop_customers').update(patch).eq('id', id))
}

export async function receivePayment(customerId: string, amount: number, mode: PayMode) {
  check(await supabase().from('shop_payments').insert({ customer_id: customerId, amount, mode }))
}

export async function addJob(j: {
  customer_id: string | null
  car_no: string
  model: string
  work: string
  tech: string
  labour: number
}) {
  check(await supabase().from('shop_jobs').insert(j))
}

export async function setJobStatus(id: string, status: Job['status']) {
  check(await supabase().from('shop_jobs').update({ status }).eq('id', id))
}

export async function addQuote(q: { customer_id: string | null; items: Quote['items']; total: number }) {
  return check(await supabase().from('shop_quotes').insert(q).select().single()) as Quote
}

// ---------------------------------------------------------------------------
// Owner only
// ---------------------------------------------------------------------------

export async function report(from: number, to: number, bucketStarts: number[] = []): Promise<Report> {
  const r: any = check(
    await supabase().rpc('shop_report', {
      p_from: new Date(from).toISOString(),
      p_to: new Date(to).toISOString(),
      p_buckets: bucketStarts.map(b => new Date(b).toISOString())
    })
  )
  return {
    sales: toNum(r.sales),
    bills: toNum(r.bills),
    cash: toNum(r.cash),
    upi: toNum(r.upi),
    card: toNum(r.card),
    later: toNum(r.later),
    items: toNum(r.items),
    profit: toNum(r.profit),
    expenses: toNum(r.expenses),
    received: toNum(r.received),
    stock_in: toNum(r.stock_in),
    drawer: {
      cash: toNum(r.drawer?.cash),
      upi: toNum(r.drawer?.upi),
      card: toNum(r.drawer?.card)
    },
    buckets: (r.buckets ?? []).map(toNum),
    products: (r.products ?? []).map((p: any) => ({
      ...p,
      qty: toNum(p.qty),
      sales: toNum(p.sales),
      profit: toNum(p.profit)
    }))
  }
}

export async function saveSettings(patch: Partial<Settings>) {
  check(await supabase().from('shop_settings').update(patch).eq('id', 1))
}

export async function loadMembers(): Promise<Member[]> {
  return check(
    await supabase().from('shop_members').select('*').order('created_at')
  ) as Member[]
}

export async function addStaff(email: string, name: string) {
  check(
    await supabase()
      .from('shop_members')
      .insert({ email: email.trim().toLowerCase(), role: 'staff', name: name.trim() })
  )
}

export async function removeStaff(email: string) {
  check(await supabase().from('shop_members').delete().eq('email', email))
}

export interface SupplierRow extends Supplier {
  owed: number
  purchased: number
}

export async function loadSuppliers(): Promise<{ suppliers: SupplierRow[]; purchases: Purchase[] }> {
  const sb = supabase()
  const [s, d, p] = await Promise.all([
    sb.from('shop_suppliers').select('*').order('name'),
    sb.from('shop_supplier_dues').select('*'),
    sb.from('shop_purchases').select('*').order('created_at', { ascending: false }).limit(50)
  ])
  const dues: Record<string, any> = {}
  for (const x of check(d) as any[]) dues[x.supplier_id] = x
  return {
    suppliers: (check(s) as Supplier[]).map(x => ({
      ...x,
      owed: toNum(dues[x.id]?.owed),
      purchased: toNum(dues[x.id]?.purchased)
    })),
    purchases: (check(p) as any[]).map(x => ({ ...x, amount: toNum(x.amount), paid: toNum(x.paid) }))
  }
}

export async function addSupplier(name: string, phone: string) {
  check(await supabase().from('shop_suppliers').insert({ name: name.trim(), phone: phone.trim() }))
}

export async function addPurchase(p: { supplier_id: string; amount: number; paid: number; mode: PayMode; note: string }) {
  check(await supabase().from('shop_purchases').insert(p))
}

export async function paySupplier(supplierId: string, amount: number, mode: PayMode) {
  check(await supabase().from('shop_supplier_payments').insert({ supplier_id: supplierId, amount, mode }))
}

export async function loadExpenses(from: number, to: number): Promise<Expense[]> {
  const data = check(
    await supabase()
      .from('shop_expenses')
      .select('*')
      .gte('created_at', new Date(from).toISOString())
      .lt('created_at', new Date(to).toISOString())
      .order('created_at', { ascending: false })
  ) as any[]
  return data.map(e => ({ ...e, amount: toNum(e.amount) }))
}

export async function addExpense(e: { category: string; amount: number; mode: PayMode; note: string }) {
  check(await supabase().from('shop_expenses').insert(e))
}

/** Money in minus money out per payment mode (owner, or staff when allowed). */
export async function drawer(from: number, to: number): Promise<Record<PayMode, number>> {
  const data = check(
    await supabase().rpc('shop_drawer', {
      p_from: new Date(from).toISOString(),
      p_to: new Date(to).toISOString()
    })
  ) as Record<PayMode, number | string>
  return { cash: toNum(data.cash), upi: toNum(data.upi), card: toNum(data.card) }
}

export async function deleteExpense(id: string) {
  check(await supabase().from('shop_expenses').delete().eq('id', id))
}

/** Every bill, page by page (the API returns at most 1000 rows per call). */
export async function allBills(): Promise<Bill[]> {
  const out: Bill[] = []
  for (let from = 0; ; from += 1000) {
    const page = check(
      await supabase()
        .from('shop_bills')
        .select('*, items:shop_bill_items(*)')
        .order('created_at', { ascending: true })
        .range(from, from + 999)
    ) as any[]
    out.push(...page.map(normalizeBill))
    if (page.length < 1000) return out
  }
}
