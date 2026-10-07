'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'

import { receiveStock } from '@/lib/shop/api'
import { count, num } from '@/lib/shop/format'
import { useShop } from '@/components/shop/context'
import { Icon, StockPill, TopBar } from '@/components/shop/ui'

export default function ReceiveStockPage() {
  const shop = useShop()
  const router = useRouter()
  const [q, setQ] = React.useState('')
  const [qty, setQty] = React.useState<Record<string, string>>({})
  const [cost, setCost] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  const term = q.trim().toLowerCase()
  const list = shop.products.filter(p => !term || `${p.name} ${p.code} ${p.brand}`.toLowerCase().includes(term))
  const chosen = Object.keys(qty).filter(id => num(qty[id]) > 0)
  const items = chosen.reduce((s, id) => s + Math.round(num(qty[id])), 0)

  async function save() {
    if (!chosen.length) return toast.error('Type how many arrived')
    setBusy(true)
    const n = await shop.run(() =>
      receiveStock(
        chosen.map(id => ({
          product_id: id,
          qty: Math.round(num(qty[id])),
          cost: shop.can('costs') && (cost[id] ?? '').trim() !== '' ? num(cost[id]) : null
        }))
      )
    )
    if (n !== undefined) {
      toast.success(`${count(n, 'item')} added to ${count(chosen.length, 'product')}`)
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
        <Link href="/stock/new">New products</Link>
        <Link className="on" href="/stock/receive">
          Add quantity
        </Link>
      </div>
      <div className="note">A delivery came? Type how many arrived next to each product, then save once.</div>
      <div className="search">
        <Icon name="search" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter products" aria-label="Filter products" />
      </div>
      <div className="bulk-wrap">
        <table className="bulk narrow">
          <thead>
            <tr>
              <th>Product</th>
              <th>Now</th>
              <th>+ Arrived</th>
              {shop.can('costs') ? (
                <th>
                  New buy ₹ <span className="lock">OWNER</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {list.map(p => (
              <tr key={p.id}>
                <td className="name">{p.name}</td>
                <td>
                  <StockPill p={p} />
                </td>
                <td className="num">
                  <input
                    value={qty[p.id] ?? ''}
                    onChange={e => setQty(s => ({ ...s, [p.id]: e.target.value }))}
                    inputMode="numeric"
                    placeholder="0"
                    aria-label={'Arrived for ' + p.name}
                  />
                </td>
                {shop.can('costs') ? (
                  <td className="num">
                    <input
                      value={cost[p.id] ?? ''}
                      onChange={e => setCost(s => ({ ...s, [p.id]: e.target.value }))}
                      inputMode="decimal"
                      placeholder={shop.costs[p.id] !== undefined ? String(shop.costs[p.id]) : '0'}
                      aria-label={'New buying price for ' + p.name}
                    />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="stick">
        <button className="big blue" onClick={save} disabled={busy || !chosen.length}>
          {chosen.length ? `Add ${count(items, 'item')} to ${count(chosen.length, 'product')}` : 'Type quantities to add'}
        </button>
      </div>
    </>
  )
}
