import Link from 'next/link'

import {
  type MovementType,
  type StockMovementWithProduct,
  formatDateTime,
  formatMoney,
  movementLabels
} from '@/lib/inventory'
import { cn } from '@/lib/utils'

export function MovementList({
  movements,
  showProduct = false
}: {
  movements: StockMovementWithProduct[]
  showProduct?: boolean
}) {
  if (movements.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No stock movements yet.
      </p>
    )
  }

  return (
    <ul className="divide-y">
      {movements.map(movement => (
        <li key={movement.id} className="flex items-start gap-3 py-3 text-sm">
          <span
            className={cn(
              'w-12 shrink-0 text-right font-mono font-semibold tabular-nums',
              movement.quantity_change > 0
                ? 'text-green-600 dark:text-green-500'
                : movement.quantity_change < 0
                ? 'text-red-600 dark:text-red-500'
                : 'text-muted-foreground'
            )}
          >
            {movement.quantity_change > 0 ? '+' : ''}
            {movement.quantity_change}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-medium">
              {showProduct && movement.products ? (
                <Link
                  href={`/inventory/${movement.products.id}`}
                  className="hover:underline"
                >
                  {movement.products.name}
                </Link>
              ) : (
                movementLabels[movement.type as MovementType]
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {showProduct
                ? `${movementLabels[movement.type as MovementType]} · `
                : ''}
              {formatDateTime(movement.created_at)}
              {movement.unit_price !== null
                ? ` · ${formatMoney(movement.unit_price)} each`
                : ''}
              {movement.note ? ` · ${movement.note}` : ''}
            </div>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            Bal {movement.quantity_after}
          </span>
        </li>
      ))}
    </ul>
  )
}
