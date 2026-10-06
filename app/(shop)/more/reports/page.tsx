'use client'

import * as React from 'react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'

import { report } from '@/lib/shop/api'
import { count, rs } from '@/lib/shop/format'
import { type Bucket, buckets, PERIODS, PREVIOUS, periodLabel, periodRange, type PeriodType } from '@/lib/shop/periods'
import type { Report, ReportProduct } from '@/lib/shop/types'
import { useShop } from '@/components/shop/context'
import { Change, Empty, Icon, Loading, Meter, OwnerOnly, TopBar } from '@/components/shop/ui'

type SortKey = 'profit' | 'qty' | 'margin'

export default function ReportsPage() {
  const shop = useShop()
  const [type, setType] = React.useState<PeriodType>('month')
  const [off, setOff] = React.useState(0)
  const [now, setNow] = React.useState<Report | null>(null)
  const [before, setBefore] = React.useState<Report | null>(null)
  const [sort, setSort] = React.useState<SortKey>('profit')
  const [all, setAll] = React.useState(false)
  const [bar, setBar] = React.useState(-1)
  const range = periodRange(type, off)
  const bars = buckets(type, range)

  React.useEffect(() => {
    if (!shop.isOwner) return
    let live = true
    setNow(null)
    const r = periodRange(type, off)
    const prev = periodRange(type, off - 1)
    Promise.all([report(r[0], r[1], buckets(type, r).map(b => b.start)), report(prev[0], prev[1])]).then(
      ([a, b]) => {
        if (!live) return
        setNow(a)
        setBefore(b)
      },
      () => live && toast.error("Couldn't load the report")
    )
    return () => {
      live = false
    }
  }, [type, off, shop.isOwner, shop.bills])

  if (!shop.isOwner) return <OwnerOnly title="Reports" />

  const products: (ReportProduct & { margin: number; label: string })[] = (now?.products ?? []).map(p => ({
    ...p,
    margin: p.sales ? p.profit / p.sales : 0,
    label: p.product_id ? p.name : 'Fitting & labour'
  }))
  products.sort((a, b) => (sort === 'qty' ? b.qty - a.qty : sort === 'margin' ? b.margin - a.margin : b.profit - a.profit))
  const shown = all ? products : products.slice(0, 8)
  const sold = new Set(products.map(p => p.product_id))
  const notSold = shop.products.filter(p => p.qty > 0 && !sold.has(p.id))
  const categories = new Map<string, { sales: number; profit: number }>()
  for (const p of products) {
    const name = p.product_id ? p.category ?? 'No category' : 'Fitting & labour'
    const c = categories.get(name) ?? { sales: 0, profit: 0 }
    c.sales += p.sales
    c.profit += p.profit
    categories.set(name, c)
  }
  const real = now ? now.profit - now.expenses : 0
  const realBefore = before ? before.profit - before.expenses : 0

  return (
    <>
      <TopBar title="Reports" sub="Owner only" back="/more" />
      <div className="seg5">
        {PERIODS.map(([t, label]) => (
          <button
            key={t}
            className={type === t ? 'on' : ''}
            onClick={() => {
              setType(t)
              setOff(0)
              setBar(-1)
              setAll(false)
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="pnav">
        <button className="back" onClick={() => (setOff(o => o - 1), setBar(-1))} aria-label="Previous">
          <Icon name="back" />
        </button>
        <b>{periodLabel(type, range, off)}</b>
        <button
          className="back flip"
          onClick={() => (setOff(o => Math.min(0, o + 1)), setBar(-1))}
          disabled={off >= 0}
          aria-label="Next"
        >
          <Icon name="back" />
        </button>
      </div>
      {!now ? (
        <Loading />
      ) : (
        <>
          <div className="hero">
            <span className="l">Sales</span>
            <span className="v">{rs(now.sales)}</span>
            <span className="s">
              <span>{count(now.bills, 'bill')}</span>
              {before?.sales ? (
                <span>
                  {now.sales >= before.sales ? '▲ ' : '▼ '}
                  {Math.abs(Math.round(((now.sales - before.sales) / before.sales) * 100))}% vs {PREVIOUS[type]}
                </span>
              ) : null}
            </span>
          </div>
          <div className="kp">
            <div className="card">
              <div className="k">Profit</div>
              <div className="v">{rs(now.profit)}</div>
              <Change now={now.profit} before={before?.profit ?? 0} />
            </div>
            <div className="card">
              <div className="k">Expenses</div>
              <div className="v">{rs(now.expenses)}</div>
            </div>
            <div className="card">
              <div className="k">Real profit</div>
              <div className="v" style={{ color: real < 0 ? 'var(--red)' : 'var(--green)' }}>
                {rs(real)}
              </div>
              <Change now={real} before={realBefore} />
            </div>
          </div>
          <div className="kp">
            <div className="card">
              <div className="k">Avg bill</div>
              <div className="v">{rs(now.bills ? now.sales / now.bills : 0)}</div>
            </div>
            <div className="card">
              <div className="k">Items sold</div>
              <div className="v">{now.items}</div>
              <Change now={now.items} before={before?.items ?? 0} />
            </div>
            <div className="card">
              <div className="k">Margin</div>
              <div className="v">{now.sales ? Math.round((now.profit / now.sales) * 100) : 0}%</div>
            </div>
          </div>

          <SalesChart bars={bars} values={now.buckets} selected={bar} onSelect={setBar} label={periodLabel(type, range, off)} />

          <div className="sec">Profit per product</div>
          <div className="card">
            <div className="chips" style={{ marginBottom: 6 }}>
              {(
                [
                  ['profit', 'Most profit'],
                  ['qty', 'Most sold'],
                  ['margin', 'Best margin']
                ] as [SortKey, string][]
              ).map(([k, label]) => (
                <button key={k} className={'chip' + (sort === k ? ' on' : '')} onClick={() => setSort(k)}>
                  {label}
                </button>
              ))}
            </div>
            {shown.length ? (
              shown.map((p, i) => (
                <div className="row" key={p.product_id ?? 'fitting'}>
                  <span className="thumb">{i + 1}</span>
                  <span className="t">
                    {p.label}
                    <small>
                      {p.qty} sold · sales {rs(p.sales)}
                    </small>
                  </span>
                  <span className="r" style={{ color: p.profit < 0 ? 'var(--red)' : undefined }}>
                    {rs(p.profit)}
                    <small>{Math.round(p.margin * 100)}% margin</small>
                  </span>
                </div>
              ))
            ) : (
              <Empty>No sales in this period.</Empty>
            )}
            {products.length > 8 ? (
              <button className="link" onClick={() => setAll(a => !a)}>
                {all ? 'Show top 8' : `Show all ${products.length} products`}
              </button>
            ) : null}
          </div>

          <div className="sec">By category</div>
          <div className="card">
            {categories.size ? (
              Array.from(categories.entries())
                .sort((a, b) => b[1].sales - a[1].sales)
                .map(([name, c]) => <Meter key={name} label={name} value={c.sales} total={now.sales} note={'profit ' + rs(c.profit)} />)
            ) : (
              <Empty>No sales.</Empty>
            )}
          </div>

          <div className="sec">How customers paid</div>
          <div className="card">
            <Meter label="Cash" value={now.cash} total={now.sales} />
            <Meter label="UPI" value={now.upi} total={now.sales} />
            <Meter label="Card" value={now.card} total={now.sales} />
            <Meter label="Udhaar given" value={now.later} total={now.sales} />
            <div className="row">
              <span className="t">
                Udhaar money received
                <small>old dues paid back in this period</small>
              </span>
              <span className="r">{rs(now.received)}</span>
            </div>
          </div>

          <div className="sec">Stock</div>
          <div className="card">
            <div className="row">
              <span className="t">Items sold</span>
              <span className="r">{now.items}</span>
            </div>
            <div className="row">
              <span className="t">
                Items received
                <small>deliveries and new products</small>
              </span>
              <span className="r">{now.stock_in}</span>
            </div>
            <div className="row">
              <span className="t">
                Stock value now
                <small>at buying price · at selling price</small>
              </span>
              <span className="r">
                {rs(shop.products.reduce((s, p) => s + p.qty * (shop.costs[p.id] ?? 0), 0))}
                <small>{rs(shop.products.reduce((s, p) => s + p.qty * p.price, 0))}</small>
              </span>
            </div>
            <Link className="row" href="/stock?show=low">
              <span className="t">Low or out of stock now</span>
              <span className="pill a">{shop.products.filter(p => p.qty <= p.reorder_level).length}</span>
              <span className="chev">›</span>
            </Link>
            <div className="row">
              <span className="t">
                Not sold in this period
                <small className="wrap">{notSold.slice(0, 4).map(p => p.name).join(', ') || 'Everything sold'}</small>
              </span>
              <span className="pill n">{notSold.length}</span>
            </div>
          </div>
        </>
      )}
    </>
  )
}

function niceStep(x: number) {
  const p = Math.pow(10, Math.floor(Math.log10(x)))
  const n = x / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p
}

function short(v: number) {
  if (v >= 100000) return v / 100000 + 'L'
  if (v >= 1000) return v / 1000 + 'k'
  return String(v)
}

function SalesChart({
  bars,
  values,
  selected,
  onSelect,
  label
}: {
  bars: Bucket[]
  values: number[]
  selected: number
  onSelect: (i: number) => void
  label: string
}) {
  const max = Math.max(1000, ...values)
  const step = niceStep(max / 3)
  const top = Math.ceil(max / step) * step
  const L = 40
  const R = 336
  const T = 8
  const B = 136
  const bw = (R - L) / Math.max(1, bars.length)
  const y = (v: number) => B - (v / top) * (B - T)
  const lines: number[] = []
  for (let k = 0; k <= top + 1; k += step) lines.push(k)
  const sel = selected >= 0 && selected < bars.length ? selected : -1

  return (
    <div className="card">
      <div className="readout">
        {sel >= 0 ? (
          <>
            <b>{bars[sel].full}</b>
            <span>{rs(values[sel] ?? 0)}</span>
          </>
        ) : (
          <>
            <b>Sales over time</b>
            <span className="muted">Tap a bar</span>
          </>
        )}
      </div>
      <svg className="bars" viewBox="0 0 340 160" role="img" aria-label={'Sales chart for ' + label}>
        <line className="base" x1={L} y1={B} x2={R} y2={B} />
        {lines.map(k => (
          <g key={k}>
            <line className="gl" x1={L} y1={y(k)} x2={R} y2={y(k)} />
            <text className="axt" x={L - 6} y={y(k) + 3.5} textAnchor="end">
              {short(k)}
            </text>
          </g>
        ))}
        {bars.map((b, i) => {
          const v = values[i] ?? 0
          const w = Math.max(1.5, bw - 2)
          const x = L + i * bw + 1
          const h = B - y(v)
          const rr = Math.min(4, w / 2, h)
          const yy = B - h
          return (
            <g key={b.start}>
              {h > 0 ? (
                <path
                  className={'bar' + (sel >= 0 && sel !== i ? ' dim' : '')}
                  d={`M${x} ${B} V${yy + rr} Q${x} ${yy} ${x + rr} ${yy} H${x + w - rr} Q${x + w} ${yy} ${x + w} ${yy + rr} V${B} Z`}
                />
              ) : null}
              {b.label ? (
                <text className="axt" x={x + w / 2} y={152} textAnchor="middle">
                  {b.label}
                </text>
              ) : null}
              <rect className="hit" x={L + i * bw} y={0} width={bw} height={160} onClick={() => onSelect(sel === i ? -1 : i)}>
                <title>
                  {b.full}: {rs(v)}
                </title>
              </rect>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
