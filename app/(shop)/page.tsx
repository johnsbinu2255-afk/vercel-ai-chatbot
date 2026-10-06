'use client'

import * as React from 'react'
import Link from 'next/link'

import { report } from '@/lib/shop/api'
import { count, DAY, payLabel, rs, startOfDay, ts } from '@/lib/shop/format'
import { useShop } from '@/components/shop/context'
import { Empty, Icon, TopBar } from '@/components/shop/ui'

export default function HomePage() {
  const shop = useShop()
  const [profit, setProfit] = React.useState<number | null>(null)
  const dayStart = startOfDay(Date.now())
  const today = shop.bills.filter(b => !b.cancelled && ts(b.created_at) >= dayStart)
  const sales = today.reduce((s, b) => s + b.total, 0)

  // Profit needs buying prices, which only the owner's account can read.
  React.useEffect(() => {
    if (!shop.isOwner) return
    report(dayStart, dayStart + DAY).then(r => setProfit(r.profit), () => setProfit(null))
  }, [shop.isOwner, shop.bills, dayStart])

  const out = shop.products.filter(p => p.qty === 0)
  const low = shop.products.filter(p => p.qty > 0 && p.qty <= p.reorder_level)
  const dueCustomers = shop.customers.filter(c => shop.due(c.id) > 0.5)
  const totalDue = dueCustomers.reduce((s, c) => s + shop.due(c.id), 0)
  const ready = shop.jobs.filter(j => j.status === 'ready')
  const recent = shop.bills.filter(b => !b.cancelled).slice(0, 4)
  const h = new Date().getHours()
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  const [sh, sm] = (shop.settings.summary_time || '21:00').split(':').map(Number)
  const summaryReady = h > sh || (h === sh && new Date().getMinutes() >= (sm || 0))

  return (
    <>
      <TopBar title={shop.settings.name} sub={greeting} />
      <div className="hero">
        <span className="l">Today&apos;s sales</span>
        <span className="v">{rs(sales)}</span>
        <span className="s">
          <span>{count(today.length, 'bill')}</span>
          <span>
            {shop.isOwner ? (profit === null ? 'Profit …' : 'Profit ' + rs(profit)) : 'Profit: owner only'}
          </span>
        </span>
      </div>
      <Link className="big" href="/sell">
        <Icon name="plus" />
        New bill
      </Link>

      <div className="sec">Needs attention</div>
      <div className="card">
        {out.length ? (
          <Link className="row" href="/stock?show=low">
            <span className="ic r">
              <Icon name="alert" />
            </span>
            <span className="t">
              {out.length} out of stock
              <small>{out.map(p => p.name).join(', ')}</small>
            </span>
            <span className="chev">›</span>
          </Link>
        ) : null}
        {low.length ? (
          <Link className="row" href="/stock?show=low">
            <span className="ic a">
              <Icon name="box" />
            </span>
            <span className="t">
              {low.length} running low
              <small>{low.map(p => `${p.name} (${p.qty})`).join(', ')}</small>
            </span>
            <span className="chev">›</span>
          </Link>
        ) : null}
        {dueCustomers.length ? (
          <Link className="row" href="/more/udhaar">
            <span className="ic a">
              <Icon name="rupee" />
            </span>
            <span className="t">
              {rs(totalDue)} udhaar due
              <small>{count(dueCustomers.length, 'customer')}</small>
            </span>
            <span className="chev">›</span>
          </Link>
        ) : null}
        {ready.length ? (
          <Link className="row" href="/more/jobs">
            <span className="ic g">
              <Icon name="car" />
            </span>
            <span className="t">
              {ready.length} {ready.length === 1 ? 'car' : 'cars'} ready for pickup
              <small>{ready.map(j => `${j.car_no} · ${j.model}`).join(', ')}</small>
            </span>
            <span className="chev">›</span>
          </Link>
        ) : null}
        {!out.length && !low.length && !dueCustomers.length && !ready.length ? (
          <Empty>All good. Nothing needs you right now.</Empty>
        ) : null}
      </div>

      {shop.isOwner ? (
        <div className="card">
          <Link className="row" href="/more/summary">
            <span className="ic g">
              <Icon name="chat" />
            </span>
            <span className="t">
              Today&apos;s summary
              <small>{summaryReady ? 'Ready to send on WhatsApp' : 'Sales, profit, cash and stock in one message'}</small>
            </span>
            {summaryReady ? <span className="pill g">Ready</span> : <span className="chev">›</span>}
          </Link>
          <Link className="row" href="/more/reports">
            <span className="ic b">
              <Icon name="chart" />
            </span>
            <span className="t">
              Reports
              <small>Day, week, month, quarter, year · profit per product</small>
            </span>
            <span className="chev">›</span>
          </Link>
        </div>
      ) : null}

      <div className="sec">
        Recent bills <Link href="/more/bills">See all</Link>
      </div>
      <div className="card">
        {recent.length ? (
          recent.map(b => (
            <button className="row" key={b.id} onClick={() => shop.openSheet({ type: 'bill', id: b.id })}>
              <span className="t">
                {shop.customer(b.customer_id)?.name ?? 'Walk-in'}
                <small>{b.items.map(l => l.name).join(', ')}</small>
              </span>
              <span className="r">
                {rs(b.total)}
                <small>{b.due > 0.5 ? 'Due ' + rs(b.due) : payLabel(b)}</small>
              </span>
            </button>
          ))
        ) : (
          <Empty>No bills yet. Tap New bill to make the first one.</Empty>
        )}
      </div>
    </>
  )
}
