'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'

import { addProducts } from '@/lib/shop/api'
import { count, num } from '@/lib/shop/format'
import { type PastedRow, useShop } from '@/components/shop/context'
import { TopBar } from '@/components/shop/ui'

interface Row {
  name: string
  category_id: string
  cost: string
  price: string
  qty: string
}

export default function BulkAddPage() {
  const shop = useShop()
  const router = useRouter()
  const firstCategory = String(shop.categories[0]?.id ?? '')
  const blank = React.useCallback(
    (n: number): Row[] => Array.from({ length: n }, () => ({ name: '', category_id: firstCategory, cost: '', price: '', qty: '' })),
    [firstCategory]
  )
  const [rows, setRows] = React.useState<Row[]>(() => blank(10))
  const [busy, setBusy] = React.useState(false)
  const filled = rows.filter(r => r.name.trim())
  const items = filled.reduce((s, r) => s + Math.round(num(r.qty)), 0)

  const set = (i: number, k: keyof Row) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const v = e.target.value
    setRows(rs => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  }

  function fromPaste(pasted: PastedRow[]) {
    const byName = new Map(shop.categories.map(c => [c.name.toLowerCase(), String(c.id)]))
    const extra = pasted.map(p => ({
      name: p.name,
      category_id: byName.get(p.category.toLowerCase()) ?? firstCategory,
      cost: p.cost,
      price: p.price,
      qty: p.qty
    }))
    setRows(rs => [...rs.filter(r => r.name.trim()), ...extra, ...blank(5)])
  }

  async function save() {
    if (!filled.length) return toast.error('Type at least one product name')
    const noPrice = filled.find(r => num(r.price) <= 0)
    if (noPrice) return toast.error(`Add a sell price for “${noPrice.name}”`)
    setBusy(true)
    const n = await shop.run(() =>
      addProducts(
        filled.map(r => ({
          name: r.name.trim(),
          category_id: r.category_id ? Number(r.category_id) : null,
          price: num(r.price),
          qty: Math.max(0, Math.round(num(r.qty))),
          cost: shop.can('costs') && r.cost.trim() !== '' ? num(r.cost) : null,
          fits: 'Universal'
        }))
      )
    )
    if (n !== undefined) {
      toast.success(`${count(n, 'product')} added · ${count(items, 'item')}`)
      await shop.refresh()
      router.push('/stock')
    } else {
      setBusy(false)
    }
  }

  return (
    <>
      <TopBar title="Bulk add" sub="Add many items in one go" back="/stock" />
      <div className="seg">
        <Link className="on" href="/stock/new">
          New products
        </Link>
        <Link href="/stock/receive">Add quantity</Link>
      </div>
      <div className="note">
        One row is one product. Empty rows are skipped.
        {shop.can('costs') ? ' The buying price is only visible to you.' : " Staff can't see or enter buying prices."}
      </div>
      <div className="btns">
        <button className="btn soft" onClick={() => shop.openSheet({ type: 'paste', onRows: fromPaste })}>
          Paste from Excel
        </button>
        <button className="btn" onClick={() => setRows(rs => [...rs, ...blank(10)])}>
          + 10 more rows
        </button>
      </div>
      <div className="bulk-wrap">
        <table className="bulk">
          <thead>
            <tr>
              <th>#</th>
              <th>Product name</th>
              <th>Category</th>
              {shop.can('costs') ? (
                <th>
                  Buy ₹ <span className="lock">OWNER</span>
                </th>
              ) : null}
              <th>Sell ₹</th>
              <th>Qty</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="no">{i + 1}</td>
                <td className="nm">
                  <input value={r.name} onChange={set(i, 'name')} placeholder="Product name" aria-label={`Row ${i + 1} name`} />
                </td>
                <td>
                  <select value={r.category_id} onChange={set(i, 'category_id')} aria-label={`Row ${i + 1} category`}>
                    {shop.categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
                {shop.can('costs') ? (
                  <td className="num">
                    <input value={r.cost} onChange={set(i, 'cost')} inputMode="decimal" placeholder="0" aria-label={`Row ${i + 1} buy price`} />
                  </td>
                ) : null}
                <td className="num">
                  <input value={r.price} onChange={set(i, 'price')} inputMode="decimal" placeholder="0" aria-label={`Row ${i + 1} sell price`} />
                </td>
                <td className="num">
                  <input value={r.qty} onChange={set(i, 'qty')} inputMode="numeric" placeholder="0" aria-label={`Row ${i + 1} quantity`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="stick">
        <button className="big blue" onClick={save} disabled={busy || !filled.length}>
          {filled.length
            ? `Save ${count(filled.length, 'product')} · ${count(items, 'item')}`
            : 'Fill rows to save'}
        </button>
      </div>
    </>
  )
}
