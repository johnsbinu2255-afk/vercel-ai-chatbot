'use client'

import * as React from 'react'
import { toast } from 'react-hot-toast'

import { report } from '@/lib/shop/api'
import { count, DAY, fd, rs, startOfDay } from '@/lib/shop/format'
import type { Report } from '@/lib/shop/types'
import { useShop } from '@/components/shop/context'
import { Icon, Loading, OwnerOnly, TopBar, WaButton } from '@/components/shop/ui'

export default function SummaryPage() {
  const shop = useShop()
  const [off, setOff] = React.useState(0)
  const [day, setDay] = React.useState<Report | null>(null)
  const [prev, setPrev] = React.useState<Report | null>(null)
  const start = startOfDay(startOfDay(Date.now()) + off * DAY + (off ? DAY / 2 : 0))
  const end = startOfDay(start + DAY + DAY / 2)

  React.useEffect(() => {
    if (!shop.isOwner) return
    let live = true
    setDay(null)
    const before = startOfDay(start - DAY / 2)
    Promise.all([report(start, end), report(before, start)]).then(
      ([a, b]) => {
        if (!live) return
        setDay(a)
        setPrev(b)
      },
      () => live && toast.error("Couldn't load the summary")
    )
    return () => {
      live = false
    }
  }, [shop.isOwner, start, end, shop.bills])

  if (!shop.isOwner) return <OwnerOnly title="Night summary" />

  const label = off === 0 ? 'Today' : off === -1 ? 'Yesterday' : fd(start)
  const best = day?.products.filter(p => p.product_id).sort((a, b) => b.qty - a.qty)[0]
  const low = shop.products.filter(p => p.qty <= p.reorder_level).sort((a, b) => a.qty - b.qty)
  const pending = shop.customers.reduce((s, c) => s + Math.max(0, shop.due(c.id)), 0)
  const real = day ? day.profit - day.expenses : 0
  const to = shop.settings.owner_whatsapp || shop.settings.phone

  const text = day
    ? `${shop.settings.name} · Night summary\n` +
      new Date(start).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) +
      `\n\nSales: ${rs(day.sales)} (${count(day.bills, 'bill')})\nProfit: ${rs(day.profit)}\nExpenses: ${rs(day.expenses)}\nReal profit: ${rs(real)}\n\n` +
      `Cash: ${rs(day.cash)}\nUPI: ${rs(day.upi)}\nCard: ${rs(day.card)}\nUdhaar given: ${rs(day.later)}\nUdhaar received: ${rs(day.received)}\nCash in drawer: ${rs(day.drawer.cash)}\n\n` +
      `Items sold: ${day.items}` +
      (best ? `\nBest seller: ${best.name} (${best.qty})` : '') +
      `\nTotal udhaar pending: ${rs(pending)}` +
      (low.length ? '\nLow stock: ' + low.slice(0, 5).map(p => `${p.name} (${p.qty})`).join(', ') : '')
    : ''

  return (
    <>
      <TopBar title="Night summary" sub="Owner only" back="/more" />
      <div className="pnav">
        <button className="back" onClick={() => setOff(o => o - 1)} aria-label="Previous day">
          <Icon name="back" />
        </button>
        <b>{label}</b>
        <button className="back flip" onClick={() => setOff(o => Math.min(0, o + 1))} disabled={off >= 0} aria-label="Next day">
          <Icon name="back" />
        </button>
      </div>
      {!day ? (
        <Loading />
      ) : (
        <>
          <div className="hero">
            <span className="l">Sales</span>
            <span className="v">{rs(day.sales)}</span>
            <span className="s">
              <span>{count(day.bills, 'bill')}</span>
              <span>Profit {rs(day.profit)}</span>
              {prev?.sales ? (
                <span>
                  {day.sales >= prev.sales ? '▲ ' : '▼ '}
                  {Math.abs(Math.round(((day.sales - prev.sales) / prev.sales) * 100))}% vs day before
                </span>
              ) : null}
            </span>
          </div>
          <div className="card">
            <div className="row">
              <span className="t">
                Real profit
                <small>profit minus expenses ({rs(day.expenses)})</small>
              </span>
              <span className="r" style={{ color: real < 0 ? 'var(--red)' : 'var(--green)' }}>
                {rs(real)}
              </span>
            </div>
            <div className="row">
              <span className="t">
                Cash in drawer
                <small>cash sales + udhaar cash − cash spent</small>
              </span>
              <span className="r">{rs(day.drawer.cash)}</span>
            </div>
            <div className="row">
              <span className="t">UPI · Card</span>
              <span className="r">
                {rs(day.upi)}
                <small>card {rs(day.card)}</small>
              </span>
            </div>
            <div className="row">
              <span className="t">Udhaar given · received</span>
              <span className="r">
                {rs(day.later)}
                <small>received {rs(day.received)}</small>
              </span>
            </div>
            <div className="row">
              <span className="t">
                Items sold
                {best ? <small>Best: {best.name} ({best.qty})</small> : null}
              </span>
              <span className="r">{day.items}</span>
            </div>
            <div className="row">
              <span className="t">
                Low stock now
                <small>{low.slice(0, 4).map(p => p.name).join(', ') || 'None'}</small>
              </span>
              <span className="pill a">{low.length}</span>
            </div>
          </div>
          <div className="sec">Message preview</div>
          <div className="paper">
            <pre className="msg">{text}</pre>
          </div>
          {to ? (
            <WaButton phone={to} text={text} label="Send to my WhatsApp" className="btn wa full" />
          ) : (
            <div className="note">Add your WhatsApp number in More → Settings to send this with one tap.</div>
          )}
          <button
            className="btn full"
            onClick={() =>
              navigator.clipboard?.writeText(text).then(
                () => toast.success('Summary copied'),
                () => toast.error("Couldn't copy on this phone")
              )
            }
          >
            Copy message
          </button>
          <div className="note">
            From {shop.settings.summary_time || '21:00'} the Home screen shows the summary as ready, so you can send it with
            one tap. Fully automatic sending needs WhatsApp&apos;s paid business service.
          </div>
        </>
      )}
    </>
  )
}
