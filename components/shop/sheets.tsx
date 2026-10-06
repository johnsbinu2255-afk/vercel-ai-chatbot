'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'

import {
  addCustomer,
  addJob,
  adjustStock,
  cancelBill,
  costHistory,
  customerBills,
  deleteProduct,
  getBill,
  productMoves,
  receivePayment,
  saveProduct,
  signOut,
  updateCustomer
} from '@/lib/shop/api'
import {
  billNo,
  billText,
  fd,
  fdt,
  initials,
  num,
  payLabel,
  rs,
  warrantyLeft
} from '@/lib/shop/format'
import type { Bill, CartLine, PayMode, StockMove } from '@/lib/shop/types'
import { emptyCart, type PastedRow, type SheetSpec, useShop } from '@/components/shop/context'
import { Empty, Icon, Loading, Sheet, WaButton } from '@/components/shop/ui'

export function SheetHost({ spec }: { spec: SheetSpec }) {
  switch (spec.type) {
    case 'bill':
      return <BillSheet id={spec.id} />
    case 'product':
      return <ProductSheet id={spec.id} />
    case 'move':
      return <MoveSheet id={spec.id} />
    case 'customer':
      return <CustomerSheet id={spec.id} />
    case 'newCustomer':
      return <NewCustomerSheet forCart={!!spec.forCart} />
    case 'pickCustomer':
      return <PickCustomerSheet />
    case 'receive':
      return <ReceiveSheet customerId={spec.customerId} />
    case 'newJob':
      return <NewJobSheet />
    case 'quote':
      return <QuoteSheet id={spec.id} />
    case 'paste':
      return <PasteSheet onRows={spec.onRows} />
    case 'account':
      return <AccountSheet />
  }
}

let lineKey = 0
export function newLineKey() {
  lineKey += 1
  return 'l' + lineKey + '-' + Date.now()
}

// ---------------------------------------------------------------------------
// Bill
// ---------------------------------------------------------------------------

function BillSheet({ id }: { id: string }) {
  const shop = useShop()
  const fromList = shop.bills.find(b => b.id === id)
  const [fetched, setFetched] = React.useState<Bill | null>(null)
  const [confirm, setConfirm] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const bill = fromList ?? fetched

  React.useEffect(() => {
    if (!fromList) getBill(id).then(setFetched, () => setFetched(null))
  }, [fromList, id])

  if (!bill) {
    return (
      <Sheet title="Bill" onClose={shop.closeSheet}>
        <Loading />
      </Sheet>
    )
  }
  const cu = shop.customer(bill.customer_id)
  const car = cu?.cars[0]
  const text = billText(shop.settings.name, bill)

  return (
    <Sheet title={'Bill ' + billNo(bill.no)} onClose={shop.closeSheet}>
      <div className="paper print-area">
        <h2>{shop.settings.name}</h2>
        <div className="c">
          {[shop.settings.address, shop.settings.phone].filter(Boolean).join(' · ')}
        </div>
        <div className="m">
          <span>{billNo(bill.no)}</span>
          <span>{fdt(bill.created_at)}</span>
          <span>
            {cu ? cu.name : 'Walk-in'}
            {car ? ' · ' + car.no : ''}
          </span>
        </div>
        {bill.cancelled ? <div className="void">CANCELLED</div> : null}
        {bill.items.map(l => (
          <div className="it" key={l.id}>
            <span>
              {l.name} × {l.qty}
              {l.serial || l.warranty_months ? (
                <small>
                  {l.serial ? 'S/N ' + l.serial : ''}
                  {l.serial && l.warranty_months ? ' · ' : ''}
                  {l.warranty_months ? l.warranty_months + ' months warranty' : ''}
                </small>
              ) : null}
            </span>
            <span>{rs(l.qty * l.price)}</span>
          </div>
        ))}
        <div className="tt">
          <span>Total</span>
          <span>{rs(bill.total)}</span>
        </div>
        <div className="m">
          <span>
            Paid: {payLabel(bill)} {rs(bill.total - bill.due)}
          </span>
          {bill.due > 0.5 ? (
            <span style={{ color: 'var(--amber)', fontWeight: 800 }}>Balance {rs(bill.due)}</span>
          ) : (
            <span>Thank you!</span>
          )}
        </div>
      </div>
      <WaButton phone={cu?.phone ?? ''} text={text} label="Send on WhatsApp" className="btn wa full" />
      <div className="btns">
        <button className="btn" style={{ flex: 1 }} onClick={() => window.print()}>
          <Icon name="print" />
          Print
        </button>
        <button
          className="btn"
          style={{ flex: 1 }}
          onClick={() =>
            navigator.clipboard?.writeText(text).then(
              () => toast.success('Bill copied'),
              () => toast.error("Couldn't copy on this phone")
            )
          }
        >
          Copy text
        </button>
      </div>
      {bill.due > 0.5 && cu && !bill.cancelled ? (
        <button className="btn full" onClick={() => shop.openSheet({ type: 'receive', customerId: cu.id })}>
          Receive balance
        </button>
      ) : null}
      {shop.isOwner && !bill.cancelled ? (
        confirm ? (
          <div className="card stack">
            <b>Cancel this bill?</b>
            <span className="muted">
              The items go back into stock and the bill stops counting in sales and udhaar.
            </span>
            <div className="btns">
              <button
                className="btn red"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  const ok = await shop.run(() => cancelBill(bill.id), 'Bill cancelled')
                  setBusy(false)
                  if (ok !== undefined) {
                    await shop.refresh()
                    shop.closeSheet()
                  }
                }}
              >
                Yes, cancel bill
              </button>
              <button className="btn" onClick={() => setConfirm(false)}>
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <button className="link center" style={{ color: 'var(--red)' }} onClick={() => setConfirm(true)}>
            Cancel this bill
          </button>
        )
      ) : null}
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Product
// ---------------------------------------------------------------------------

interface ProductForm {
  name: string
  category_id: string
  brand: string
  code: string
  cost: string
  price: string
  qty: string
  reorder_level: string
  warranty_months: string
  fits: string
}

function ProductSheet({ id }: { id?: string }) {
  const shop = useShop()
  const p = shop.product(id)
  const [f, setF] = React.useState<ProductForm>(() => ({
    name: p?.name ?? '',
    category_id: String(p?.category_id ?? shop.categories[0]?.id ?? ''),
    brand: p?.brand ?? '',
    code: p?.code ?? '',
    cost: p && shop.costs[p.id] !== undefined ? String(shop.costs[p.id]) : '',
    price: p ? String(p.price) : '',
    qty: '0',
    reorder_level: String(p?.reorder_level ?? 3),
    warranty_months: String(p?.warranty_months ?? 0),
    fits: p?.fits ?? ''
  }))
  const [moves, setMoves] = React.useState<StockMove[] | null>(null)
  const [costs, setCosts] = React.useState<{ cost: number; created_at: string }[]>([])
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!p) return
    productMoves(p.id).then(setMoves, () => setMoves([]))
    if (shop.isOwner) costHistory(p.id).then(setCosts, () => setCosts([]))
  }, [p, shop.isOwner])

  const set = (k: keyof ProductForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF(prev => ({ ...prev, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!f.name.trim()) return toast.error('Type the product name')
    if (num(f.price) <= 0) return toast.error('Type the selling price')
    setBusy(true)
    const ok = await shop.run(
      () =>
        saveProduct({
          id: p?.id,
          name: f.name,
          category_id: f.category_id ? Number(f.category_id) : null,
          brand: f.brand,
          code: f.code,
          price: num(f.price),
          qty: p ? undefined : Math.round(num(f.qty)),
          reorder_level: Math.round(num(f.reorder_level)),
          warranty_months: Math.round(num(f.warranty_months)),
          fits: f.fits,
          cost: shop.isOwner && f.cost.trim() !== '' ? num(f.cost) : null
        }),
      p ? 'Saved' : 'Product added'
    )
    setBusy(false)
    if (ok !== undefined) {
      await shop.refresh()
      shop.closeSheet()
    }
  }

  const cost = p ? shop.costs[p.id] : undefined
  return (
    <Sheet title={p ? p.name : 'Add product'} onClose={shop.closeSheet}>
      {p ? (
        <>
          <div className="kp">
            <div className="card">
              <div className="k">In stock</div>
              <div className="v">{p.qty}</div>
            </div>
            <div className="card">
              <div className="k">Sell price</div>
              <div className="v">{rs(p.price)}</div>
            </div>
            <div className="card">
              <div className="k">{shop.isOwner ? 'Profit each' : 'Warranty'}</div>
              <div className="v">
                {shop.isOwner ? (cost !== undefined ? rs(p.price - cost) : '—') : p.warranty_months + ' mo'}
              </div>
            </div>
          </div>
          <button className="btn blue" onClick={() => shop.openSheet({ type: 'move', id: p.id })}>
            Change stock
          </button>
        </>
      ) : null}
      <form className="fg" onSubmit={submit}>
        <label className="f full">
          Name
          <input className="in" value={f.name} onChange={set('name')} required />
        </label>
        <label className="f">
          Category
          <select className="in" value={f.category_id} onChange={set('category_id')}>
            <option value="">No category</option>
            {shop.categories.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="f">
          Brand
          <input className="in" value={f.brand} onChange={set('brand')} />
        </label>
        {shop.isOwner ? (
          <label className="f">
            <span>
              Buy price ₹ <span className="lock">OWNER ONLY</span>
            </span>
            <input className="in" inputMode="decimal" value={f.cost} onChange={set('cost')} placeholder="0" />
          </label>
        ) : null}
        <label className="f">
          Sell price ₹
          <input className="in" inputMode="decimal" value={f.price} onChange={set('price')} required />
        </label>
        {p ? null : (
          <label className="f">
            Quantity now
            <input className="in" inputMode="numeric" value={f.qty} onChange={set('qty')} />
          </label>
        )}
        <label className="f">
          Alert when at or below
          <input className="in" inputMode="numeric" value={f.reorder_level} onChange={set('reorder_level')} />
        </label>
        <label className="f">
          Warranty (months)
          <input className="in" inputMode="numeric" value={f.warranty_months} onChange={set('warranty_months')} />
        </label>
        <label className="f">
          Code / barcode
          <input className="in" value={f.code} onChange={set('code')} />
        </label>
        <label className="f full">
          Fits which cars
          <input className="in" value={f.fits} onChange={set('fits')} placeholder="Swift, Baleno or Universal" />
        </label>
        <div className="full btns">
          <button className="btn blue" type="submit" disabled={busy}>
            {p ? 'Save changes' : 'Add product'}
          </button>
          {p && shop.isOwner && !confirmDelete ? (
            <button type="button" className="btn red" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          ) : null}
        </div>
      </form>
      {p && confirmDelete ? (
        <div className="card stack">
          <b>Delete {p.name}?</b>
          <span className="muted">It disappears from stock and selling. Old bills keep it.</span>
          <div className="btns">
            <button
              className="btn red"
              onClick={async () => {
                const ok = await shop.run(() => deleteProduct(p.id), 'Product deleted')
                if (ok !== undefined) {
                  await shop.refresh()
                  shop.closeSheet()
                }
              }}
            >
              Yes, delete
            </button>
            <button className="btn" onClick={() => setConfirmDelete(false)}>
              Keep it
            </button>
          </div>
        </div>
      ) : null}
      {p ? (
        <>
          <div className="sec">Stock history</div>
          <div className="card">
            {moves === null ? (
              <Loading />
            ) : moves.length ? (
              moves.map(m => (
                <div className="row" key={m.id}>
                  <span className="t">
                    {MOVE_LABEL[m.kind]}
                    {m.note ? ' · ' + m.note : ''}
                    <small>{fdt(m.created_at)}</small>
                  </span>
                  <span className="r" style={{ color: m.change < 0 ? 'var(--red)' : 'var(--green)' }}>
                    {m.change > 0 ? '+' : ''}
                    {m.change}
                    <small>now {m.qty_after}</small>
                  </span>
                </div>
              ))
            ) : (
              <Empty>No history yet.</Empty>
            )}
          </div>
          {shop.isOwner && costs.length ? (
            <>
              <div className="sec">Buying price history</div>
              <div className="card">
                {costs.map((c, i) => (
                  <div className="row" key={i}>
                    <span className="t">{fd(c.created_at)}</span>
                    <span className="r">{rs(c.cost)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </Sheet>
  )
}

const MOVE_LABEL: Record<StockMove['kind'], string> = {
  opening: 'Added',
  sale: 'Sold',
  delivery: 'Items arrived',
  count: 'Counted',
  return: 'Customer return',
  damaged: 'Damaged / lost',
  cancel: 'Bill cancelled'
}

function MoveSheet({ id }: { id: string }) {
  const shop = useShop()
  const p = shop.product(id)
  const [kind, setKind] = React.useState<'delivery' | 'count' | 'return' | 'damaged'>('delivery')
  const [qty, setQty] = React.useState('')
  const [note, setNote] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  if (!p) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const q = Math.round(num(qty))
    if (kind !== 'count' && q < 1) return toast.error('Type a quantity')
    setBusy(true)
    const ok = await shop.run(() => adjustStock(p!.id, kind, q, note), 'Stock updated')
    setBusy(false)
    if (ok !== undefined) {
      await shop.refresh()
      shop.openSheet({ type: 'product', id: p!.id })
    }
  }

  return (
    <Sheet title="Change stock" onClose={shop.closeSheet}>
      <b>{p.name}</b>
      <span className="muted">{p.qty} in stock now</span>
      <form className="fg" onSubmit={submit}>
        <label className="f full">
          What happened
          <select className="in" value={kind} onChange={e => setKind(e.target.value as typeof kind)}>
            <option value="delivery">Items arrived (+)</option>
            <option value="count">I counted the stock (set the number)</option>
            <option value="return">Customer returned (+)</option>
            <option value="damaged">Damaged or lost (−)</option>
          </select>
        </label>
        <label className="f">
          {kind === 'count' ? 'Counted stock' : 'Quantity'}
          <input className="in" inputMode="numeric" value={qty} onChange={e => setQty(e.target.value)} required />
        </label>
        <label className="f">
          Note
          <input className="in" value={note} onChange={e => setNote(e.target.value)} placeholder="optional" />
        </label>
        <div className="full">
          <button className="big blue" type="submit" disabled={busy}>
            Save
          </button>
        </div>
      </form>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

function CustomerSheet({ id }: { id: string }) {
  const shop = useShop()
  const router = useRouter()
  const c = shop.customer(id)
  const [bills, setBills] = React.useState<Bill[] | null>(null)
  const [carNo, setCarNo] = React.useState('')
  const [carModel, setCarModel] = React.useState('')

  React.useEffect(() => {
    customerBills(id).then(setBills, () => setBills([]))
  }, [id])

  if (!c) return null
  const due = shop.due(c.id)
  const live = (bills ?? []).filter(b => !b.cancelled)
  const warranty = live.flatMap(b =>
    b.items
      .filter(l => l.warranty_months > 0)
      .map(l => ({ bill: b, line: l, left: warrantyLeft(b.created_at, l.warranty_months) }))
  )

  async function addCar(e: React.FormEvent) {
    e.preventDefault()
    if (!carNo.trim()) return
    const cars = [...c!.cars, { no: carNo.trim().toUpperCase(), model: carModel.trim() }]
    const ok = await shop.run(() => updateCustomer(c!.id, { cars }), 'Car added')
    if (ok !== undefined) {
      setCarNo('')
      setCarModel('')
      await shop.refresh()
    }
  }

  return (
    <Sheet title={c.name} onClose={shop.closeSheet}>
      <span className="muted">
        {c.phone || 'No phone'}
        {c.cars.length ? ' · ' + c.cars.map(v => `${v.model} ${v.no}`.trim()).join(', ') : ''}
      </span>
      <div className="kp">
        <div className="card">
          <div className="k">Bills</div>
          <div className="v">{bills ? live.length : '…'}</div>
        </div>
        <div className="card">
          <div className="k">Spent</div>
          <div className="v">{bills ? rs(live.reduce((s, b) => s + b.total, 0)) : '…'}</div>
        </div>
        <div className="card">
          <div className="k">Udhaar</div>
          <div className="v">{rs(Math.max(0, due))}</div>
        </div>
      </div>
      <div className="btns">
        <button
          className="btn blue"
          onClick={() => {
            shop.setCart({ ...emptyCart(), customerId: c.id })
            shop.closeSheet()
            router.push('/sell')
          }}
        >
          New bill
        </button>
        {c.phone ? <WaButton phone={c.phone} text={`Hello ${c.name}, `} label="WhatsApp" /> : null}
        {due > 0.5 ? (
          <button className="btn" onClick={() => shop.openSheet({ type: 'receive', customerId: c.id })}>
            Receive money
          </button>
        ) : null}
      </div>
      <div className="sec">Cars</div>
      <div className="card">
        {c.cars.map((v, i) => (
          <div className="row" key={i}>
            <span className="ic b">
              <Icon name="car" />
            </span>
            <span className="t">
              {v.no}
              <small>{v.model}</small>
            </span>
          </div>
        ))}
        <form className="fg" onSubmit={addCar} style={{ marginTop: 8 }}>
          <label className="f">
            Car number
            <input className="in" value={carNo} onChange={e => setCarNo(e.target.value)} placeholder="KL-07-AB-1234" />
          </label>
          <label className="f">
            Model
            <input className="in" value={carModel} onChange={e => setCarModel(e.target.value)} placeholder="Swift" />
          </label>
          <div className="full">
            <button className="btn sm" type="submit">
              + Add car
            </button>
          </div>
        </form>
      </div>
      <div className="sec">Warranty</div>
      <div className="card">
        {bills === null ? (
          <Loading />
        ) : warranty.length ? (
          warranty.map((w, i) => (
            <div className="row" key={i}>
              <span className="t">
                {w.line.name}
                <small>
                  {w.line.serial ? 'S/N ' + w.line.serial + ' · ' : ''}bought {fd(w.bill.created_at)}
                </small>
              </span>
              {w.left < 0 ? (
                <span className="pill r">Expired</span>
              ) : (
                <span className="pill g">{w.left} months left</span>
              )}
            </div>
          ))
        ) : (
          <Empty>No warranty items.</Empty>
        )}
      </div>
      <div className="sec">Bills</div>
      <div className="card">
        {bills === null ? (
          <Loading />
        ) : bills.length ? (
          bills.map(b => (
            <button className="row" key={b.id} onClick={() => shop.openSheet({ type: 'bill', id: b.id })}>
              <span className="t">
                {billNo(b.no)}
                <small>
                  {fd(b.created_at)}
                  {b.cancelled ? ' · cancelled' : ''}
                </small>
              </span>
              <span className="r">
                {rs(b.total)}
                {b.due > 0.5 && !b.cancelled ? (
                  <small style={{ color: 'var(--amber)' }}>due {rs(b.due)}</small>
                ) : null}
              </span>
            </button>
          ))
        ) : (
          <Empty>No bills yet.</Empty>
        )}
      </div>
    </Sheet>
  )
}

function NewCustomerSheet({ forCart }: { forCart: boolean }) {
  const shop = useShop()
  const [name, setName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [carNo, setCarNo] = React.useState('')
  const [model, setModel] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast.error('Type the name')
    setBusy(true)
    const c = await shop.run(
      () =>
        addCustomer({
          name: name.trim(),
          phone: phone.trim(),
          cars: carNo.trim() ? [{ no: carNo.trim().toUpperCase(), model: model.trim() }] : []
        }),
      'Customer saved'
    )
    setBusy(false)
    if (c) {
      if (forCart) shop.setCart(cart => ({ ...cart, customerId: c.id }))
      await shop.refresh()
      shop.closeSheet()
    }
  }

  return (
    <Sheet title="New customer" onClose={shop.closeSheet}>
      <form className="fg" onSubmit={submit}>
        <label className="f full">
          Name
          <input className="in" value={name} onChange={e => setName(e.target.value)} required autoFocus />
        </label>
        <label className="f">
          Phone
          <input className="in" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} />
        </label>
        <label className="f">
          Car number
          <input className="in" value={carNo} onChange={e => setCarNo(e.target.value)} placeholder="KL-07-AB-1234" />
        </label>
        <label className="f full">
          Car model
          <input className="in" value={model} onChange={e => setModel(e.target.value)} placeholder="Swift" />
        </label>
        <div className="full">
          <button className="big blue" type="submit" disabled={busy}>
            Save customer
          </button>
        </div>
      </form>
    </Sheet>
  )
}

function PickCustomerSheet() {
  const shop = useShop()
  const [q, setQ] = React.useState('')
  const term = q.trim().toLowerCase()
  const list = shop.customers.filter(
    c =>
      !term ||
      (c.name + ' ' + c.phone + ' ' + c.cars.map(v => v.no + ' ' + v.model).join(' '))
        .toLowerCase()
        .includes(term)
  )
  const pick = (id: string | null) => {
    shop.setCart(cart => ({ ...cart, customerId: id }))
    shop.closeSheet()
  }
  return (
    <Sheet title="Choose customer" onClose={shop.closeSheet}>
      <div className="search">
        <Icon name="search" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Name, phone or car number" autoFocus />
      </div>
      <button className="btn blue" onClick={() => shop.openSheet({ type: 'newCustomer', forCart: true })}>
        <Icon name="plus" />
        New customer
      </button>
      <div className="card">
        <button className="row" onClick={() => pick(null)}>
          <span className="t">
            Walk-in customer<small>No name</small>
          </span>
        </button>
        {list.slice(0, 50).map(c => (
          <button className="row" key={c.id} onClick={() => pick(c.id)}>
            <span className="thumb">{initials(c.name)}</span>
            <span className="t">
              {c.name}
              <small>
                {c.phone}
                {c.cars[0] ? ' · ' + c.cars[0].no : ''}
              </small>
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

function ReceiveSheet({ customerId }: { customerId: string }) {
  const shop = useShop()
  const c = shop.customer(customerId)
  const due = shop.due(customerId)
  const [amount, setAmount] = React.useState(String(Math.max(0, Math.round(due))))
  const [mode, setMode] = React.useState<PayMode>('cash')
  const [busy, setBusy] = React.useState(false)
  if (!c) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const a = num(amount)
    if (a <= 0) return toast.error('Type an amount')
    setBusy(true)
    const ok = await shop.run(() => receivePayment(customerId, a, mode), 'Money received')
    setBusy(false)
    if (ok !== undefined) {
      await shop.refresh()
      shop.closeSheet()
    }
  }

  return (
    <Sheet title="Receive money" onClose={shop.closeSheet}>
      <span>
        {c.name} owes <b>{rs(due)}</b>
      </span>
      <form className="fg" onSubmit={submit}>
        <label className="f">
          Amount ₹
          <input className="in" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} required />
        </label>
        <label className="f">
          Paid by
          <select className="in" value={mode} onChange={e => setMode(e.target.value as PayMode)}>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
          </select>
        </label>
        <div className="full">
          <button className="big blue" type="submit" disabled={busy}>
            Save
          </button>
        </div>
      </form>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Fitting jobs and quotations
// ---------------------------------------------------------------------------

function NewJobSheet() {
  const shop = useShop()
  const [customerId, setCustomerId] = React.useState('')
  const [carNo, setCarNo] = React.useState('')
  const [model, setModel] = React.useState('')
  const [work, setWork] = React.useState('')
  const [tech, setTech] = React.useState('')
  const [labour, setLabour] = React.useState('500')
  const [busy, setBusy] = React.useState(false)
  const techs = Array.from(new Set(shop.jobs.map(j => j.tech).filter(Boolean)))

  // Picking a customer fills in their first car.
  function pickCustomer(id: string) {
    setCustomerId(id)
    const car = shop.customer(id)?.cars[0]
    if (car) {
      setCarNo(car.no)
      setModel(car.model)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!carNo.trim() || !work.trim()) return toast.error('Type the car number and the work')
    setBusy(true)
    const ok = await shop.run(
      () =>
        addJob({
          customer_id: customerId || null,
          car_no: carNo.trim().toUpperCase(),
          model: model.trim(),
          work: work.trim(),
          tech: tech.trim(),
          labour: num(labour)
        }),
      'Job created'
    )
    setBusy(false)
    if (ok !== undefined) {
      await shop.refresh()
      shop.closeSheet()
    }
  }

  return (
    <Sheet title="New fitting job" onClose={shop.closeSheet}>
      <form className="fg" onSubmit={submit}>
        <label className="f full">
          Customer
          <select className="in" value={customerId} onChange={e => pickCustomer(e.target.value)}>
            <option value="">Walk-in</option>
            {shop.customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="f">
          Car number
          <input className="in" value={carNo} onChange={e => setCarNo(e.target.value)} required />
        </label>
        <label className="f">
          Car model
          <input className="in" value={model} onChange={e => setModel(e.target.value)} />
        </label>
        <label className="f full">
          Work
          <input className="in" value={work} onChange={e => setWork(e.target.value)} required placeholder="Fit Android stereo" />
        </label>
        <label className="f">
          Technician
          <input className="in" list="shop-techs" value={tech} onChange={e => setTech(e.target.value)} />
          <datalist id="shop-techs">
            {techs.map(t => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
        <label className="f">
          Fitting charge ₹
          <input className="in" inputMode="decimal" value={labour} onChange={e => setLabour(e.target.value)} />
        </label>
        <div className="full">
          <button className="big blue" type="submit" disabled={busy}>
            Create job
          </button>
        </div>
      </form>
    </Sheet>
  )
}

function QuoteSheet({ id }: { id: string }) {
  const shop = useShop()
  const router = useRouter()
  const q = shop.quotes.find(x => x.id === id)
  if (!q) return null
  const cu = shop.customer(q.customer_id)
  const text =
    `${shop.settings.name}\nQuotation Q-${q.no} · ${fd(q.created_at)}\n\n` +
    q.items.map(l => `${l.name} × ${l.qty} = ${rs(l.qty * l.price)}`).join('\n') +
    `\n\nTotal: ${rs(q.total)}\nValid for 7 days.`

  function makeBill() {
    const lines: CartLine[] = q!.items.map(l => {
      const p = shop.product(l.product_id)
      return {
        key: newLineKey(),
        product_id: p ? p.id : null,
        name: l.name,
        qty: l.qty,
        price: l.price,
        serial: '',
        warranty_months: p?.warranty_months ?? 0
      }
    })
    shop.setCart({ ...emptyCart(), customerId: q!.customer_id, quoteId: q!.id, lines })
    shop.closeSheet()
    router.push('/sell')
  }

  return (
    <Sheet title={'Quotation Q-' + q.no} onClose={shop.closeSheet}>
      <div className="paper print-area">
        <h2>{shop.settings.name}</h2>
        <div className="c">QUOTATION · valid 7 days</div>
        <div className="m">
          <span>Q-{q.no}</span>
          <span>{fd(q.created_at)}</span>
          <span>{cu ? cu.name : 'Walk-in'}</span>
        </div>
        {q.items.map((l, i) => (
          <div className="it" key={i}>
            <span>
              {l.name} × {l.qty}
            </span>
            <span>{rs(l.qty * l.price)}</span>
          </div>
        ))}
        <div className="tt">
          <span>Total</span>
          <span>{rs(q.total)}</span>
        </div>
      </div>
      {q.status === 'open' ? (
        <button className="big blue" onClick={makeBill}>
          Make bill
        </button>
      ) : (
        <span className="pill g" style={{ justifySelf: 'center' }}>
          Already billed
        </span>
      )}
      <WaButton phone={cu?.phone ?? ''} text={text} label="Send on WhatsApp" className="btn wa full" />
      <button className="btn full" onClick={() => window.print()}>
        <Icon name="print" />
        Print
      </button>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Paste from Excel
// ---------------------------------------------------------------------------

function PasteSheet({ onRows }: { onRows: (rows: PastedRow[]) => void }) {
  const shop = useShop()
  const [text, setText] = React.useState('')
  const owner = shop.isOwner
  const columns = owner
    ? 'Name · Buy price · Sell price · Quantity · Category (optional)'
    : 'Name · Sell price · Quantity · Category (optional)'

  function fill() {
    const rows: PastedRow[] = []
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim()
      if (!line) continue
      const c = (line.includes('\t') ? line.split('\t') : line.split(',')).map(x => x.trim())
      const [name, a, b, d, e] = c
      const row: PastedRow = owner
        ? { name, cost: a ?? '', price: b ?? '', qty: d ?? '', category: e ?? '' }
        : { name, cost: '', price: a ?? '', qty: b ?? '', category: d ?? '' }
      // Skip a header row or junk: there must be a name and at least one number.
      if (!row.name || (num(row.price) <= 0 && num(row.qty) <= 0 && num(row.cost) <= 0)) continue
      rows.push(row)
    }
    if (!rows.length) return toast.error("Couldn't read any rows. Check the column order.")
    onRows(rows)
    shop.closeSheet()
    toast.success(rows.length + ' rows filled. Check them, then save.')
  }

  return (
    <Sheet title="Paste from Excel" onClose={shop.closeSheet}>
      <span className="muted" style={{ fontSize: 14 }}>
        Copy the rows from Excel or Google Sheets and paste them here. Columns in this order:
        <br />
        <b style={{ color: 'var(--ink)' }}>{columns}</b>
      </span>
      <textarea
        className="in"
        rows={8}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={owner ? 'Seat Cover Set\t1500\t2499\t10' : 'Seat Cover Set\t2499\t10'}
      />
      <button className="big blue" onClick={fill}>
        Fill rows
      </button>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

function AccountSheet() {
  const shop = useShop()
  const router = useRouter()
  return (
    <Sheet title="Your account" onClose={shop.closeSheet}>
      <div className="card">
        <div className="row">
          <span className="t">
            {shop.me.email}
            <small>{shop.isOwner ? 'Owner: sees everything' : 'Staff: no buying prices or profit'}</small>
          </span>
          <span className={'pill ' + (shop.isOwner ? 'b' : 'a')}>{shop.isOwner ? 'Owner' : 'Staff'}</span>
        </div>
      </div>
      <button
        className="btn full"
        onClick={async () => {
          await signOut()
          shop.closeSheet()
          router.push('/sign-in')
          router.refresh()
        }}
      >
        Sign out
      </button>
    </Sheet>
  )
}
