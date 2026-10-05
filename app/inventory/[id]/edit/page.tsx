import { notFound } from 'next/navigation'

import { getCategories, getProduct } from '../../actions'
import { ProductForm } from '@/components/inventory/product-form'

export const metadata = {
  title: 'Edit product'
}

export default async function EditProductPage({
  params
}: {
  params: { id: string }
}) {
  const [categories, product] = await Promise.all([
    getCategories(),
    getProduct(params.id)
  ])
  if (!product) notFound()

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Edit {product.name}</h1>
      <div className="rounded-lg border bg-background p-6">
        <ProductForm categories={categories} product={product} />
      </div>
    </div>
  )
}
