'use client'

import * as React from 'react'

import type { ShopData } from '@/lib/shop/api'
import type { Cart, Category, Customer, Me, Product } from '@/lib/shop/types'

export interface PastedRow {
  name: string
  cost: string
  price: string
  qty: string
  category: string
}

export type SheetSpec =
  | { type: 'bill'; id: string }
  | { type: 'product'; id?: string }
  | { type: 'move'; id: string }
  | { type: 'customer'; id: string }
  | { type: 'newCustomer'; forCart?: boolean }
  | { type: 'pickCustomer' }
  | { type: 'receive'; customerId: string }
  | { type: 'newJob' }
  | { type: 'quote'; id: string }
  | { type: 'paste'; onRows: (rows: PastedRow[]) => void }
  | { type: 'account' }

export interface Shop extends ShopData {
  me: Me
  isOwner: boolean
  refresh: () => Promise<void>
  cart: Cart
  setCart: React.Dispatch<React.SetStateAction<Cart>>
  resetCart: () => void
  openSheet: (s: SheetSpec) => void
  closeSheet: () => void
  /**
   * Runs an action, shows `ok` when it worked and the error message when it didn't.
   * Resolves to the action's result (null for actions that return nothing), or undefined when it failed.
   */
  run: <T>(fn: () => Promise<T>, ok?: string) => Promise<T | undefined>
  customer: (id: string | null | undefined) => Customer | undefined
  product: (id: string | null | undefined) => Product | undefined
  category: (id: number | null | undefined) => Category | undefined
  due: (customerId: string | null | undefined) => number
}

export const ShopContext = React.createContext<Shop | null>(null)

export function useShop(): Shop {
  const shop = React.useContext(ShopContext)
  if (!shop) throw new Error('useShop must be used inside the shop app')
  return shop
}

export function emptyCart(): Cart {
  return { lines: [], customerId: null, mode: 'upi', paidNow: 0, jobId: null, quoteId: null }
}

/** Turns database errors into messages a shop owner understands. */
export function friendly(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e)
  if (/shop_products_code/.test(msg)) return 'Another product already uses this code'
  if (/shop_members_pkey|duplicate key value.*shop_members/.test(msg)) return 'This email is already added'
  if (/shop_categories_name_key/.test(msg)) return 'This category already exists'
  if (/row-level security|permission denied/i.test(msg)) return "You don't have permission to do this"
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'No internet. Check your connection and try again.'
  if (/invalid input syntax/i.test(msg)) return 'Please check the numbers you typed'
  return msg
}
