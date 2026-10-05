import Link from 'next/link'

import { getCategories, getProducts, getStockMovements } from './actions'
import { formatMoney, isLowStock } from '@/lib/inventory'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { IconPlus } from '@/components/ui/icons'
import { MovementList } from '@/components/inventory/movement-list'

export const metadata = {
  title: 'Inventory'
}

interface InventoryPageProps {
  searchParams: {
    category?: string
    q?: string
    low?: string
  }
}

function hrefWith(
  current: InventoryPageProps['searchParams'],
  changes: Partial<InventoryPageProps['searchParams']>
) {
  const params = new URLSearchParams()
  const merged = { ...current, ...changes }
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value)
  }
  const query = params.toString()
  return query ? `/inventory?${query}` : '/inventory'
}

export default async function InventoryPage({
  searchParams
}: InventoryPageProps) {
  const [categories, products, movements] = await Promise.all([
    getCategories(),
    getProducts(),
    getStockMovements({ limit: 10 })
  ])

  const search = searchParams.q?.trim().toLowerCase() ?? ''
  const categoryId = Number(searchParams.category) || null
  const lowOnly = searchParams.low === '1'

  const filtered = products.filter(product => {
    if (categoryId && product.category_id !== categoryId) return false
    if (lowOnly && !isLowStock(product)) return false
    if (search) {
      const haystack = [product.name, product.brand, product.model, product.sku]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(search)) return false
    }
    return true
  })

  const totalUnits = products.reduce((sum, p) => sum + p.quantity, 0)
  const stockCost = products.reduce(
    (sum, p) => sum + p.quantity * Number(p.purchase_price),
    0
  )
  const stockRetail = products.reduce(
    (sum, p) => sum + p.quantity * Number(p.selling_price),
    0
  )
  const lowStockCount = products.filter(isLowStock).length

  const stats = [
    { label: 'Products', value: products.length.toString() },
    { label: 'Units in stock', value: totalUnits.toString() },
    { label: 'Stock value (cost)', value: formatMoney(stockCost) },
    { label: 'Stock value (selling)', value: formatMoney(stockRetail) }
  ]

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Stock for your car accessory shop.
          </p>
        </div>
        <Link
          href={
            categoryId
              ? `/inventory/new?category=${categoryId}`
              : '/inventory/new'
          }
          className={buttonVariants()}
        >
          <IconPlus className="mr-2" />
          Add product
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(stat => (
          <div key={stat.label} className="rounded-lg border bg-background p-4">
            <div className="text-xs text-muted-foreground">{stat.label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {lowStockCount > 0 && !lowOnly ? (
        <Link
          href={hrefWith(searchParams, { low: '1' })}
          className="block rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm hover:bg-amber-500/20"
        >
          <span className="font-medium">
            {lowStockCount} product{lowStockCount === 1 ? '' : 's'} running low.
          </span>{' '}
          View them and reorder →
        </Link>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link
          href={hrefWith(searchParams, { category: undefined })}
          className={badgeLink(!categoryId)}
        >
          All ({products.length})
        </Link>
        {categories.map(category => {
          const count = products.filter(
            p => p.category_id === category.id
          ).length
          return (
            <Link
              key={category.id}
              href={hrefWith(searchParams, {
                category: String(category.id)
              })}
              className={badgeLink(categoryId === category.id)}
            >
              {category.name} ({count})
            </Link>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-3">
          <form className="flex gap-2" action="/inventory">
            {categoryId ? (
              <input type="hidden" name="category" value={categoryId} />
            ) : null}
            {lowOnly ? <input type="hidden" name="low" value="1" /> : null}
            <Input
              name="q"
              placeholder="Search name, brand, model or SKU"
              defaultValue={searchParams.q}
              className="bg-background"
            />
            {lowOnly ? (
              <Link
                href={hrefWith(searchParams, { low: undefined })}
                className={cn(
                  buttonVariants({ variant: 'outline' }),
                  'shrink-0 bg-background'
                )}
              >
                Low stock ✕
              </Link>
            ) : null}
          </form>

          <div className="overflow-x-auto rounded-lg border bg-background">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Product</th>
                  <th className="hidden px-4 py-2 font-medium sm:table-cell">
                    Category
                  </th>
                  <th className="px-4 py-2 text-right font-medium">Price</th>
                  <th className="px-4 py-2 text-right font-medium">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      {products.length === 0 ? (
                        <>
                          No products yet.{' '}
                          <Link
                            href="/inventory/new"
                            className="underline underline-offset-4"
                          >
                            Add your first product
                          </Link>
                          .
                        </>
                      ) : (
                        'No products match these filters.'
                      )}
                    </td>
                  </tr>
                ) : (
                  filtered.map(product => (
                    <tr key={product.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/inventory/${product.id}`}
                          className="font-medium hover:underline"
                        >
                          {product.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {[product.brand, product.model, product.sku]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        {product.categories?.name}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatMoney(product.selling_price)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge
                          variant={
                            product.quantity === 0
                              ? 'destructive'
                              : isLowStock(product)
                              ? 'outline'
                              : 'secondary'
                          }
                          className={cn(
                            'tabular-nums',
                            product.quantity > 0 &&
                              isLowStock(product) &&
                              'border-amber-500 text-amber-600 dark:text-amber-400'
                          )}
                        >
                          {product.quantity === 0
                            ? 'Out of stock'
                            : product.quantity}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="h-fit rounded-lg border bg-background p-4">
          <h2 className="font-semibold">Recent activity</h2>
          <MovementList movements={movements} showProduct />
        </aside>
      </div>
    </div>
  )
}

function badgeLink(active: boolean) {
  return cn(
    'rounded-full border px-3 py-1 text-sm transition-colors',
    active
      ? 'border-primary bg-primary text-primary-foreground'
      : 'bg-background hover:bg-accent'
  )
}
