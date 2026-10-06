'use client'

import * as React from 'react'

import { count, initials, rs } from '@/lib/shop/format'
import { useShop } from '@/components/shop/context'
import { Empty, Icon, TopBar } from '@/components/shop/ui'

export default function CustomersPage() {
  const shop = useShop()
  const [q, setQ] = React.useState('')
  const term = q.trim().toLowerCase()
  const list = shop.customers.filter(
    c =>
      !term ||
      `${c.name} ${c.phone} ${c.cars.map(v => v.no + ' ' + v.model).join(' ')}`.toLowerCase().includes(term)
  )
  return (
    <>
      <TopBar title="Customers" sub={count(shop.customers.length, 'customer')} back="/more" />
      <button className="btn blue" onClick={() => shop.openSheet({ type: 'newCustomer' })}>
        <Icon name="plus" />
        Add customer
      </button>
      <div className="search">
        <Icon name="search" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Name, phone or car number" aria-label="Search customers" />
      </div>
      <div className="card">
        {list.length ? (
          list.map(c => {
            const due = shop.due(c.id)
            return (
              <button className="row" key={c.id} onClick={() => shop.openSheet({ type: 'customer', id: c.id })}>
                <span className="thumb">{initials(c.name)}</span>
                <span className="t">
                  {c.name}
                  <small>
                    {c.phone}
                    {c.cars[0] ? ` · ${c.cars[0].model} ${c.cars[0].no}` : ''}
                  </small>
                </span>
                {due > 0.5 ? <span className="pill a">{rs(due)}</span> : <span className="chev">›</span>}
              </button>
            )
          })
        ) : (
          <Empty>{shop.customers.length ? 'No customers found.' : 'No customers yet.'}</Empty>
        )}
      </div>
    </>
  )
}
