'use server'
import 'server-only'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { Database } from '@/lib/db_types'
import {
  type Category,
  type MovementType,
  type ProductWithCategory,
  type StockMovementWithProduct
} from '@/lib/inventory'

function getClient() {
  const cookieStore = cookies()
  return createServerActionClient<Database>({
    cookies: () => cookieStore
  })
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message: unknown }).message)
    if (message.includes('products_user_sku_idx')) {
      return 'Another product already uses this SKU'
    }
    return message
  }
  return 'Something went wrong'
}

export async function getCategories(): Promise<Category[]> {
  const { data } = await getClient()
    .from('categories')
    .select('*')
    .order('sort_order')
    .throwOnError()
  return data ?? []
}

export async function getProducts(): Promise<ProductWithCategory[]> {
  const { data } = await getClient()
    .from('products')
    .select('*, categories(id, name)')
    .order('name')
    .throwOnError()
  return (data as ProductWithCategory[]) ?? []
}

export async function getProduct(id: string) {
  const { data } = await getClient()
    .from('products')
    .select('*, categories(id, name)')
    .eq('id', id)
    .maybeSingle()
  return (data as ProductWithCategory) ?? null
}

export async function getStockMovements({
  productId,
  limit = 50
}: {
  productId?: string
  limit?: number
} = {}): Promise<StockMovementWithProduct[]> {
  let query = getClient()
    .from('stock_movements')
    .select('*, products(id, name)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (productId) {
    query = query.eq('product_id', productId)
  }
  const { data } = await query.throwOnError()
  return (data as StockMovementWithProduct[]) ?? []
}

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function number(formData: FormData, key: string, fallback = 0) {
  const value = text(formData, key)
  if (value === null) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid value for ${key.replace('_', ' ')}`)
  }
  return parsed
}

function parseProduct(formData: FormData) {
  const name = text(formData, 'name')
  if (!name) throw new Error('Product name is required')
  const categoryId = Number(text(formData, 'category_id'))
  if (!categoryId) throw new Error('Please choose a category')

  return {
    name,
    category_id: categoryId,
    brand: text(formData, 'brand'),
    model: text(formData, 'model'),
    sku: text(formData, 'sku'),
    purchase_price: number(formData, 'purchase_price'),
    selling_price: number(formData, 'selling_price'),
    reorder_level: Math.floor(number(formData, 'reorder_level', 5)),
    notes: text(formData, 'notes')
  }
}

export async function createProduct(formData: FormData) {
  try {
    const product = parseProduct(formData)
    const openingStock = Math.floor(number(formData, 'quantity'))
    const supabase = getClient()

    const { data } = await supabase
      .from('products')
      .insert(product)
      .select('id')
      .single()
      .throwOnError()

    if (data && openingStock > 0) {
      await supabase
        .rpc('record_stock_movement', {
          p_product_id: data.id,
          p_type: 'in',
          p_quantity: openingStock,
          p_unit_price: product.purchase_price,
          p_note: 'Opening stock'
        })
        .throwOnError()
    }

    revalidatePath('/inventory')
    return { id: data?.id }
  } catch (error) {
    return { error: errorMessage(error) }
  }
}

export async function updateProduct(id: string, formData: FormData) {
  try {
    const product = parseProduct(formData)
    await getClient()
      .from('products')
      .update(product)
      .eq('id', id)
      .throwOnError()

    revalidatePath('/inventory')
    revalidatePath(`/inventory/${id}`)
    return { id }
  } catch (error) {
    return { error: errorMessage(error) }
  }
}

export async function deleteProduct(id: string) {
  try {
    await getClient().from('products').delete().eq('id', id).throwOnError()
    revalidatePath('/inventory')
    return {}
  } catch (error) {
    return { error: errorMessage(error) }
  }
}

export async function recordStockMovement(
  productId: string,
  formData: FormData
) {
  try {
    const type = text(formData, 'type') as MovementType | null
    if (type !== 'in' && type !== 'out' && type !== 'adjust') {
      throw new Error('Choose a movement type')
    }
    const quantity = Math.floor(number(formData, 'quantity'))
    const unitPrice = text(formData, 'unit_price')

    await getClient()
      .rpc('record_stock_movement', {
        p_product_id: productId,
        p_type: type,
        p_quantity: quantity,
        p_unit_price:
          unitPrice === null ? undefined : number(formData, 'unit_price'),
        p_note: text(formData, 'note') ?? undefined
      })
      .throwOnError()

    revalidatePath('/inventory')
    revalidatePath(`/inventory/${productId}`)
    return {}
  } catch (error) {
    return { error: errorMessage(error) }
  }
}
