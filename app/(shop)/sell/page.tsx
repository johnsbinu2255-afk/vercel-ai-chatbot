'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'

import { addQuote, createBill } from '@/lib/shop/api'
import { count, initials, num, rs } from '@/lib/shop/format'
import type { CartLine, Product } from '@/lib/shop/types'
import { emptyCart, useShop } from '@/components/shop/context'
import { newLineKey } from '@/components/shop/sheets'
import { Empty, Icon, TopBar } from '@/components/shop/ui'

const MODES: [CartLineMode, string][] = [
  ['cash', 'Cash'],
  ['upi', 'UPI'],
  ['card', 'Card'],
  ['later', 'Later']
]
type CartLineMode = 'cash' | 'upi' | 'card' | 'later'

export default function SellPage() {
  const shop = useShop()
  const router = useRouter()
  const { cart, setCart } = shop
  const [q, setQ] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const term = q.trim().toLowerCase()
  const results = term
    ? shop.products
        .filter(p => `${p.name} ${p.brand} ${p.code} ${p.fits}`.toLowerCase().includes(term))
        .slice(0, 8)
    : []
  const total = cart.lines.reduce((s, l) => s + l.qty * l.price, 0)
  const items = cart.lines.reduce((s, l) => s + l.qty, 0)
  const cu = shop.customer(cart.customerId)

  // Most sold products in recent bills, for one-tap adding.
  const popular = React.useMemo(() => {
    const count = new Map<string, number>()
    for (const b of shop.bills) for (const l of b.items) if (l.product_id) count.set(l.product_id, (count.get(l.product_id) ?? 0) + l.qty)
    return shop.products
      .filter(p => p.qty > 0)
      .sort((a, b) => (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0))
      .slice(0, 8)
  }, [shop.bills, shop.products])

  function inCart(id: string) {
    return cart.lines.filter(l => l.product_id === id).reduce((s, l) => s + l.qty, 0)
  }

  function add(p: Product) {
    if (inCart(p.id) + 1 > p.qty) return toast.error(`Only ${p.qty} in stock`)
    setCart(c => {
      const line = c.lines.find(l => l.product_id === p.id)
      if (line) return { ...c, lines: c.lines.map(l => (l === line ? { ...l, qty: l.qty + 1 } : l)) }
      const fresh: CartLine = {
        key: newLineKey(),
        product_id: p.id,
        name: p.name,
        qty: 1,
        price: p.price,
        serial: '',
        warranty_months: p.warranty_months
      }
      return { ...c, lines: [...c.lines, fresh] }
    })
    setQ('')
    toast.success('Added ' + p.name, { id: 'cart-add' })
  }

  function change(key: string, patch: Partial<CartLine>) {
    setCart(c => ({ ...c, lines: c.lines.map(l => (l.key === key ? { ...l, ...patch } : l)) }))
  }

  function step(line: CartLine, by: number) {
    const next = line.qty + by
    if (next < 1) {
      setCart(c => ({ ...c, lines: c.lines.filter(l => l.key !== line.key) }))
      return
    }
    const p = shop.product(line.product_id)
    if (p && inCart(p.id) + by > p.qty) return toast.error(`Only ${p.qty} in stock`)
    change(line.key, { qty: next })
  }

  // A barcode scanner types the code and presses Enter; so can a person.
  function onEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' || !term) return
    e.preventDefault()
    const exact = shop.products.find(p => p.code && p.code.toLowerCase() === term)
    if (exact) return add(exact)
    if (results.length === 1) return add(results[0])
    toast.error(results.length ? 'Tap Add on the right product' : 'No product with that code')
  }

  async function save() {
    if (!cart.lines.length) return
    if (cart.mode === 'later' && total - cart.paidNow > 0.5 && !cart.customerId) {
      return toast.error("Add the customer's name for udhaar")
    }
    setBusy(true)
    const id = await shop.run(() => createBill(cart))
    if (id) {
      shop.resetCart()
      await shop.refresh()
      router.push('/sell/done/' + id)
    } else {
      setBusy(false)
    }
  }

  async function saveQuote() {
    if (!cart.lines.length) return
    setBusy(true)
    const quote = await shop.run(
      () =>
        addQuote({
          customer_id: cart.customerId,
          items: cart.lines.map(l => ({ product_id: l.product_id, name: l.name, qty: l.qty, price: l.price })),
          total
        }),
      'Quotation saved'
    )
    setBusy(false)
    if (quote) {
      shop.resetCart()
      await shop.refresh()
      router.push('/more/quotes')
    }
  }

  return (
    <>
      <TopBar
        title="New bill"
        sub={cart.jobId ? 'Billing a fitting job' : cart.quoteId ? 'From a quotation' : undefined}
      />
      <div className="btns">
        <button className={'btn' + (cu ? ' soft' : '')} onClick={() => shop.openSheet({ type: 'pickCustomer' })}>
          <Icon name="users" />
          {cu ? cu.name : 'Add customer'}
        </button>
        {cart.lines.length ? (
          <button className="btn" onClick={() => setCart(emptyCart())}>
            Clear
          </button>
        ) : null}
      </div>
      <div className="search">
        <Icon name="search" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={onEnter}
          placeholder="Search product or type code"
          autoComplete="off"
          aria-label="Search product"
        />
        <span style={{ color: 'var(--blue)' }}>
          <Icon name="scan" />
        </span>
      </div>

      {term ? (
        <div className="card">
          {results.length ? (
            results.map(p => (
              <div className="row" key={p.id}>
                <span className="t">
                  {p.name}
                  <small>
                    {rs(p.price)} · {p.qty ? p.qty + ' in stock' : 'out of stock'}
                  </small>
                </span>
                <button className="add" onClick={() => add(p)} disabled={!p.qty}>
                  Add
                </button>
              </div>
            ))
          ) : (
            <Empty>No product found.</Empty>
          )}
        </div>
      ) : !cart.lines.length && popular.length ? (
        <>
          <div className="sec">Quick add</div>
          <div className="chips wrap">
            {popular.map(p => (
              <button className="chip" key={p.id} onClick={() => add(p)}>
                {p.name}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <div className="card">
        {cart.lines.length ? (
          cart.lines.map(l => (
            <div className="line" key={l.key}>
              <span className="thumb">{l.product_id ? initials(l.name) : <Icon name="wrench" />}</span>
              <div className="t">
                {l.product_id ? (
                  <span>{l.name}</span>
                ) : (
                  <input
                    className="nm"
                    value={l.name}
                    onChange={e => change(l.key, { name: e.target.value })}
                    aria-label="Item name"
                  />
                )}
                <span className="mini">
                  <input
                    className="pr"
                    inputMode="decimal"
                    value={String(l.price)}
                    onChange={e => change(l.key, { price: Math.max(0, num(e.target.value)) })}
                    aria-label={'Price of ' + l.name}
                  />
                  {l.warranty_months ? (
                    <input
                      className="sn"
                      value={l.serial}
                      onChange={e => change(l.key, { serial: e.target.value })}
                      placeholder="Serial no."
                      aria-label={'Serial number of ' + l.name}
                    />
                  ) : null}
                </span>
              </div>
              <div className="qty">
                <button onClick={() => step(l, -1)} aria-label={'One less ' + l.name}>
                  −
                </button>
                {l.qty}
                <button onClick={() => step(l, 1)} aria-label={'One more ' + l.name}>
                  +
                </button>
              </div>
            </div>
          ))
        ) : (
          <Empty>Search above or tap a product to start the bill.</Empty>
        )}
        <button
          className="link"
          onClick={() =>
            setCart(c => ({
              ...c,
              lines: [
                ...c.lines,
                { key: newLineKey(), product_id: null, name: 'Fitting charge', qty: 1, price: 500, serial: '', warranty_months: 0 }
              ]
            }))
          }
        >
          + Add fitting charge
        </button>
      </div>

      {cart.lines.length ? (
        <>
          <div className="card">
            <div className="tot">
              <span>{count(items, 'item')}</span>
              <b>{rs(total)}</b>
            </div>
          </div>
          <div className="sec">How did they pay?</div>
          <div className="pays">
            {MODES.map(([m, label]) => (
              <button
                key={m}
                className={'pay' + (cart.mode === m ? ' on' : '')}
                onClick={() => setCart(c => ({ ...c, mode: m }))}
              >
                {label}
              </button>
            ))}
          </div>
          {cart.mode === 'later' ? (
            <label className="f">
              Paid now in cash (the rest goes to udhaar)
              <input
                className="in"
                inputMode="decimal"
                value={cart.paidNow ? String(cart.paidNow) : ''}
                placeholder="0"
                onChange={e => setCart(c => ({ ...c, paidNow: Math.max(0, num(e.target.value)) }))}
              />
            </label>
          ) : null}
          <button className="big" onClick={save} disabled={busy}>
            Save bill · {rs(total)}
          </button>
          <button className="link center" onClick={saveQuote} disabled={busy}>
            Save as quotation instead
          </button>
        </>
      ) : null}
    </>
  )
}
