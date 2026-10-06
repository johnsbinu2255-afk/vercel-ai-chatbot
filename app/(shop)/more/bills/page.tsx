'use client'

import * as React from 'react'

import { olderBills } from '@/lib/shop/api'
import { billNo, count, fdt, payLabel, rs } from '@/lib/shop/format'
import type { Bill } from '@/lib/shop/types'
import { useShop } from '@/components/shop/context'
import { Empty, Icon, TopBar } from '@/components/shop/ui'

export default function BillsPage() {
  const shop = useShop()
  const [q, setQ] = React.useState('')
  const [older, setOlder] = React.useState<Bill[]>([])
  const [busy, setBusy] = React.useState(false)
  const [end, setEnd] = React.useState(shop.bills.length < 200)
  const all = [...shop.bills, ...older]
  const term = q.trim().toLowerCase()
  const list = all.filter(
    b =>
      !term ||
      `${billNo(b.no)} ${b.no} ${shop.customer(b.customer_id)?.name ?? 'walk-in'} ${b.items.map(l => l.name).join(' ')}`
        .toLowerCase()
        .includes(term)
  )

  async function more() {
    const last = all[all.length - 1]
    if (!last) return
    setBusy(true)
    const page = await shop.run(() => olderBills(last.created_at))
    setBusy(false)
    if (page) {
      setOlder(o => [...o, ...page])
      if (page.length < 100) setEnd(true)
    }
  }

  return (
    <>
      <TopBar title="All bills" sub={count(all.length, 'bill') + ' loaded'} back="/more" />
      <div className="search">
        <Icon name="search" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Bill number, customer or item" aria-label="Search bills" />
      </div>
      <div className="card">
        {list.length ? (
          list.map(b => (
            <button className="row" key={b.id} onClick={() => shop.openSheet({ type: 'bill', id: b.id })}>
              <span className="t">
                {billNo(b.no)} · {shop.customer(b.customer_id)?.name ?? 'Walk-in'}
                <small>
                  {fdt(b.created_at)} · {b.items.map(l => l.name).join(', ')}
                </small>
              </span>
              <span className="r">
                {rs(b.total)}
                <small>
                  {b.cancelled ? (
                    <span style={{ color: 'var(--red)' }}>Cancelled</span>
                  ) : b.due > 0.5 ? (
                    <span style={{ color: 'var(--amber)' }}>Due {rs(b.due)}</span>
                  ) : (
                    payLabel(b)
                  )}
                </small>
              </span>
            </button>
          ))
        ) : (
          <Empty>No bills found.</Empty>
        )}
      </div>
      {!end ? (
        <button className="btn full" onClick={more} disabled={busy}>
          Load older bills
        </button>
      ) : null}
    </>
  )
}
