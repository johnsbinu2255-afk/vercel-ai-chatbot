'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

import { count, initials, rs } from '@/lib/shop/format'
import { useShop } from '@/components/shop/context'
import { Empty, Icon, StockPill, TopBar } from '@/components/shop/ui'

export default function StockPage() {
  const shop = useShop()
  const params = useSearchParams()
  const [q, setQ] = React.useState('')
  const [filter, setFilter] = React.useState<string>(params?.get('show') === 'low' ? 'low' : '')
  const term = q.trim().toLowerCase()
  const low = shop.products.filter(p => p.qty <= p.reorder_level)
  const list = shop.products.filter(p => {
    if (filter === 'low' && p.qty > p.reorder_level) return false
    if (filter && filter !== 'low' && String(p.category_id) !== filter) return false
    return !term || `${p.name} ${p.brand} ${p.code} ${p.fits}`.toLowerCase().includes(term)
  })
  const units = shop.products.reduce((s, p) => s + p.qty, 0)

  return (
    <>
      <TopBar title="Stock" sub={`${count(shop.products.length, 'product')} · ${count(units, 'item')}`} />
      <div className="btns">
        <Link className="btn blue" href="/stock/new">
          <Icon name="layers" />
          Bulk add
        </Link>
        <Link className="btn" href="/stock/receive">
          <Icon name="plus" />
          Add quantity
        </Link>
      </div>
      {shop.isOwner ? (
        <div className="kp">
          <div className="card">
            <div className="k">Stock value (buy)</div>
            <div className="v">{rs(shop.products.reduce((s, p) => s + p.qty * (shop.costs[p.id] ?? 0), 0))}</div>
          </div>
          <div className="card">
            <div className="k">Stock value (sell)</div>
            <div className="v">{rs(shop.products.reduce((s, p) => s + p.qty * p.price, 0))}</div>
          </div>
          <div className="card">
            <div className="k">Low / out</div>
            <div className="v">{low.length}</div>
          </div>
        </div>
      ) : null}
      <div className="search">
        <Icon name="search" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search name, brand, code or car"
          aria-label="Search stock"
        />
      </div>
      <div className="chips">
        <button className={'chip' + (!filter ? ' on' : '')} onClick={() => setFilter('')}>
          All
        </button>
        <button className={'chip' + (filter === 'low' ? ' on' : '')} onClick={() => setFilter('low')}>
          Low ({low.length})
        </button>
        {shop.categories.map(c => (
          <button
            key={c.id}
            className={'chip' + (filter === String(c.id) ? ' on' : '')}
            onClick={() => setFilter(String(c.id))}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="card">
        {list.length ? (
          list.map(p => (
            <button className="row" key={p.id} onClick={() => shop.openSheet({ type: 'product', id: p.id })}>
              <span className="thumb">{initials(shop.category(p.category_id)?.name ?? p.name)}</span>
              <span className="t">
                {p.name}
                <small>
                  {[p.brand, rs(p.price), shop.isOwner && shop.costs[p.id] !== undefined ? 'buy ' + rs(shop.costs[p.id]) : '']
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              </span>
              <StockPill p={p} />
            </button>
          ))
        ) : shop.products.length ? (
          <Empty>No products here.</Empty>
        ) : (
          <Empty>
            No products yet. Tap <b>Bulk add</b> to add many at once, or the <b>+</b> button for one.
          </Empty>
        )}
      </div>
      <button className="fab" onClick={() => shop.openSheet({ type: 'product' })} aria-label="Add product">
        <Icon name="plus" />
      </button>
    </>
  )
}
