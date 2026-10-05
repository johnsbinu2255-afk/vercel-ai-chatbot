import { getCategories } from '../actions'
import { ProductForm } from '@/components/inventory/product-form'

export const metadata = {
  title: 'Add product'
}

export default async function NewProductPage({
  searchParams
}: {
  searchParams: { category?: string }
}) {
  const categories = await getCategories()

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Add product</h1>
      <div className="rounded-lg border bg-background p-6">
        <ProductForm
          categories={categories}
          defaultCategoryId={Number(searchParams.category) || undefined}
        />
      </div>
    </div>
  )
}
