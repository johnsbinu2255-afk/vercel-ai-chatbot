import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getProduct, getStockMovements } from '../actions'
import { formatMoney, isLowStock } from '@/lib/inventory'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { IconArrowRight, IconEdit } from '@/components/ui/icons'
import { DeleteProductButton } from '@/components/inventory/delete-product-button'
import { MovementList } from '@/components/inventory/movement-list'
import { StockMovementForm } from '@/components/inventory/stock-movement-form'

export async function generateMetadata({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id)
  return { title: product?.name ?? 'Product' }
}

export default async function ProductPage({
  params
}: {
  params: { id: string }
}) {
  const [product, movements] = await Promise.all([
    getProduct(params.id),
    getStockMovements({ productId: params.id })
  ])
  if (!product) notFound()

  const margin = Number(product.selling_price) - Number(product.purchase_price)
  const details = [
    { label: 'Category', value: product.categories?.name ?? '—' },
    { label: 'Brand', value: product.brand ?? '—' },
    { label: 'Model', value: product.model ?? '—' },
    { label: 'SKU / Barcode', value: product.sku ?? '—' },
    { label: 'Cost', value: formatMoney(product.purchase_price) },
    { label: 'Selling price', value: formatMoney(product.selling_price) },
    { label: 'Margin per unit', value: formatMoney(margin) },
    { label: 'Low stock alert at', value: String(product.reorder_level) }
  ]

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <Link
        href="/inventory"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <IconArrowRight className="mr-1 rotate-180" />
        Inventory
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{product.name}</h1>
          <p className="text-sm text-muted-foreground">
            {product.categories?.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/inventory/${product.id}/edit`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <IconEdit className="mr-2" />
            Edit
          </Link>
          <DeleteProductButton id={product.id} name={product.name} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <div className="rounded-lg border bg-background p-4">
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  'text-4xl font-semibold tabular-nums',
                  product.quantity === 0
                    ? 'text-red-600 dark:text-red-500'
                    : isLowStock(product) &&
                        'text-amber-600 dark:text-amber-400'
                )}
              >
                {product.quantity}
              </span>
              <span className="text-sm text-muted-foreground">
                in stock
                {product.quantity === 0
                  ? ' — out of stock'
                  : isLowStock(product)
                  ? ' — running low, time to reorder'
                  : ''}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
              {details.map(detail => (
                <div key={detail.label}>
                  <dt className="text-xs text-muted-foreground">
                    {detail.label}
                  </dt>
                  <dd className="font-medium">{detail.value}</dd>
                </div>
              ))}
            </dl>
            {product.notes ? (
              <p className="mt-4 whitespace-pre-wrap border-t pt-4 text-sm">
                {product.notes}
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border bg-background p-4">
            <h2 className="font-semibold">Stock history</h2>
            <MovementList movements={movements} />
          </div>
        </div>

        <aside className="h-fit rounded-lg border bg-background p-4">
          <h2 className="mb-4 font-semibold">Update stock</h2>
          <StockMovementForm product={product} />
        </aside>
      </div>
    </div>
  )
}
