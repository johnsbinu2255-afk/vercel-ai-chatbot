export type Role = 'owner' | 'staff'

export interface Me {
  email: string
  role: Role | null
  hasOwner: boolean
}

export interface Settings {
  name: string
  address: string
  phone: string
  owner_whatsapp: string
  summary_time: string
  /** The owner lets staff add expenses and see today's closing. */
  staff_expenses: boolean
}

export interface Category {
  id: number
  name: string
  sort_order: number
}

export interface Product {
  id: string
  name: string
  category_id: number | null
  brand: string
  code: string
  price: number
  qty: number
  reorder_level: number
  warranty_months: number
  fits: string
  created_at: string
}

export interface Car {
  no: string
  model: string
}

export interface Customer {
  id: string
  name: string
  phone: string
  cars: Car[]
  created_at: string
}

export interface BillItem {
  id: number
  product_id: string | null
  name: string
  qty: number
  price: number
  warranty_months: number
  serial: string
}

export interface Bill {
  id: string
  no: number
  created_at: string
  customer_id: string | null
  total: number
  paid_cash: number
  paid_upi: number
  paid_card: number
  due: number
  cancelled: boolean
  created_by: string
  items: BillItem[]
}

export type JobStatus = 'waiting' | 'working' | 'ready' | 'billed'

export interface Job {
  id: string
  no: number
  created_at: string
  customer_id: string | null
  car_no: string
  model: string
  work: string
  tech: string
  labour: number
  status: JobStatus
}

export interface QuoteItem {
  product_id: string | null
  name: string
  qty: number
  price: number
}

export interface Quote {
  id: string
  no: number
  created_at: string
  customer_id: string | null
  items: QuoteItem[]
  total: number
  status: 'open' | 'billed'
}

export interface Due {
  customer_id: string
  due: number
  oldest_unpaid: string | null
}

export type MoveKind =
  | 'opening'
  | 'sale'
  | 'delivery'
  | 'count'
  | 'return'
  | 'damaged'
  | 'cancel'

export interface StockMove {
  id: number
  product_id: string
  created_at: string
  kind: MoveKind
  change: number
  qty_after: number
  note: string
  created_by: string
}

export type PayMode = 'cash' | 'upi' | 'card'

export interface CartLine {
  key: string
  product_id: string | null
  name: string
  qty: number
  price: number
  serial: string
  warranty_months: number
}

export interface Cart {
  lines: CartLine[]
  customerId: string | null
  mode: PayMode | 'later'
  paidNow: number
  jobId: string | null
  quoteId: string | null
}

export interface ReportProduct {
  product_id: string | null
  name: string
  category: string | null
  qty: number
  sales: number
  profit: number
}

export interface Report {
  sales: number
  bills: number
  cash: number
  upi: number
  card: number
  later: number
  items: number
  profit: number
  expenses: number
  received: number
  stock_in: number
  drawer: Record<PayMode, number>
  buckets: number[]
  products: ReportProduct[]
}

export interface Member {
  email: string
  role: Role
  name: string
  created_at: string
}

export interface Supplier {
  id: string
  name: string
  phone: string
  created_at: string
}

export interface Purchase {
  id: string
  created_at: string
  supplier_id: string
  amount: number
  paid: number
  mode: PayMode
  note: string
}

export interface Expense {
  id: string
  created_at: string
  category: string
  amount: number
  mode: PayMode
  note: string
  created_by: string
}
