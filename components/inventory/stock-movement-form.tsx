'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'

import { recordStockMovement } from '@/app/inventory/actions'
import { type MovementType, type Product, formatMoney } from '@/lib/inventory'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { IconSpinner } from '@/components/ui/icons'
import { Field } from '@/components/inventory/field'

const options: { type: MovementType; label: string }[] = [
  { type: 'out', label: 'Sell' },
  { type: 'in', label: 'Stock in' },
  { type: 'adjust', label: 'Count' }
]

export function StockMovementForm({ product }: { product: Product }) {
  const router = useRouter()
  const formRef = React.useRef<HTMLFormElement>(null)
  const [type, setType] = React.useState<MovementType>('out')
  const [isPending, startTransition] = React.useTransition()

  const defaultPrice =
    type === 'out'
      ? product.selling_price
      : type === 'in'
      ? product.purchase_price
      : undefined

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    formData.set('type', type)
    startTransition(async () => {
      const result = await recordStockMovement(product.id, formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Stock updated')
      formRef.current?.reset()
      router.refresh()
    })
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-3 gap-1 rounded-md border p-1">
        {options.map(option => (
          <button
            key={option.type}
            type="button"
            onClick={() => setType(option.type)}
            className={cn(
              'rounded px-2 py-1.5 text-sm font-medium transition-colors',
              type === option.type
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <Field
        label={type === 'adjust' ? 'Counted stock' : 'Quantity'}
        htmlFor="movement-quantity"
        hint={
          type === 'adjust'
            ? `Sets stock to this number (currently ${product.quantity}).`
            : type === 'out'
            ? `${product.quantity} in stock.`
            : undefined
        }
      >
        <Input
          id="movement-quantity"
          name="quantity"
          type="number"
          min={type === 'adjust' ? 0 : 1}
          max={type === 'out' ? product.quantity : undefined}
          step="1"
          required
        />
      </Field>
      {type === 'adjust' ? null : (
        <Field
          label={type === 'out' ? 'Sold at (per unit)' : 'Cost (per unit)'}
          htmlFor="movement-price"
        >
          <Input
            key={type}
            id="movement-price"
            name="unit_price"
            type="number"
            min="0"
            step="0.01"
            defaultValue={defaultPrice ?? ''}
            placeholder={formatMoney(defaultPrice)}
          />
        </Field>
      )}
      <Field label="Note" htmlFor="movement-note">
        <Input
          id="movement-note"
          name="note"
          placeholder={
            type === 'out'
              ? 'Customer / bill no.'
              : type === 'in'
              ? 'Supplier / invoice no.'
              : 'Reason'
          }
        />
      </Field>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending && <IconSpinner className="mr-2 animate-spin" />}
        {type === 'out'
          ? 'Record sale'
          : type === 'in'
          ? 'Add stock'
          : 'Update count'}
      </Button>
    </form>
  )
}
