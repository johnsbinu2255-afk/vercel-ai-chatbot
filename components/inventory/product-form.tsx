'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'

import { createProduct, updateProduct } from '@/app/inventory/actions'
import { type Category, type Product } from '@/lib/inventory'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { IconSpinner } from '@/components/ui/icons'
import { Field, selectClassName } from '@/components/inventory/field'

interface ProductFormProps {
  categories: Category[]
  product?: Product
  defaultCategoryId?: number
}

export function ProductForm({
  categories,
  product,
  defaultCategoryId
}: ProductFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()
  const isEdit = Boolean(product)

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = product
        ? await updateProduct(product.id, formData)
        : await createProduct(formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(isEdit ? 'Product updated' : 'Product added')
      router.push(result.id ? `/inventory/${result.id}` : '/inventory')
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Product name *" htmlFor="name" className="sm:col-span-2">
          <Input
            id="name"
            name="name"
            required
            placeholder='e.g. 9" Android stereo 2GB/32GB'
            defaultValue={product?.name}
          />
        </Field>
        <Field label="Category *" htmlFor="category_id">
          <select
            id="category_id"
            name="category_id"
            required
            className={selectClassName}
            defaultValue={product?.category_id ?? defaultCategoryId ?? ''}
          >
            <option value="" disabled>
              Choose a category
            </option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="SKU / Barcode" htmlFor="sku">
          <Input id="sku" name="sku" defaultValue={product?.sku ?? ''} />
        </Field>
        <Field label="Brand" htmlFor="brand">
          <Input
            id="brand"
            name="brand"
            placeholder="e.g. Pioneer, Philips, Hella"
            defaultValue={product?.brand ?? ''}
          />
        </Field>
        <Field label="Model" htmlFor="model">
          <Input id="model" name="model" defaultValue={product?.model ?? ''} />
        </Field>
        <Field label="Purchase price (cost)" htmlFor="purchase_price">
          <Input
            id="purchase_price"
            name="purchase_price"
            type="number"
            min="0"
            step="0.01"
            defaultValue={product?.purchase_price ?? ''}
          />
        </Field>
        <Field label="Selling price" htmlFor="selling_price">
          <Input
            id="selling_price"
            name="selling_price"
            type="number"
            min="0"
            step="0.01"
            defaultValue={product?.selling_price ?? ''}
          />
        </Field>
        {isEdit ? null : (
          <Field
            label="Opening stock"
            htmlFor="quantity"
            hint="Units you have right now."
          >
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min="0"
              step="1"
              defaultValue="0"
            />
          </Field>
        )}
        <Field
          label="Low stock alert at"
          htmlFor="reorder_level"
          hint="Flag the product when stock falls to this level."
        >
          <Input
            id="reorder_level"
            name="reorder_level"
            type="number"
            min="0"
            step="1"
            defaultValue={product?.reorder_level ?? 5}
          />
        </Field>
        <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            placeholder="Fits which cars, supplier, warranty…"
            defaultValue={product?.notes ?? ''}
          />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Link
          href={product ? `/inventory/${product.id}` : '/inventory'}
          className={buttonVariants({ variant: 'outline' })}
        >
          Cancel
        </Link>
        <Button type="submit" disabled={isPending}>
          {isPending && <IconSpinner className="mr-2 animate-spin" />}
          {isEdit ? 'Save changes' : 'Add product'}
        </Button>
      </div>
    </form>
  )
}
