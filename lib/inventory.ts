import { Database } from '@/lib/db_types'

export type Category = Database['public']['Tables']['categories']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type StockMovement =
  Database['public']['Tables']['stock_movements']['Row']

export type ProductWithCategory = Product & {
  categories: Pick<Category, 'id' | 'name'> | null
}

export type StockMovementWithProduct = StockMovement & {
  products: Pick<Product, 'id' | 'name'> | null
}

export type MovementType = 'in' | 'out' | 'adjust'

export const movementLabels: Record<MovementType, string> = {
  in: 'Stock in',
  out: 'Sold / out',
  adjust: 'Adjustment'
}

// Change these to match your shop's currency.
const CURRENCY = 'INR'
const LOCALE = 'en-IN'

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  maximumFractionDigits: 2
})

export function formatMoney(value: number | null | undefined) {
  return currencyFormatter.format(Number(value ?? 0))
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString(LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

export function isLowStock(
  product: Pick<Product, 'quantity' | 'reorder_level'>
) {
  return product.quantity <= product.reorder_level
}
