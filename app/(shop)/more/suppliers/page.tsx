'use client'

import * as React from 'react'
import { toast } from 'react-hot-toast'

import { addPurchase, addSupplier, loadSuppliers, paySupplier, type SupplierRow } from '@/lib/shop/api'
import { fd, initials, num, rs } from '@/lib/shop/format'
import type { PayMode, Purchase } from '@/lib/shop/types'
import { useShop } from '@/components/shop/context'
import { Empty, Icon, Loading, OwnerOnly, Sheet, TopBar } from '@/components/shop/ui'

type Form = { kind: 'supplier' } | { kind: 'purchase' } | { kind: 'pay'; supplier: SupplierRow } | null

export default function SuppliersPage() {
  const shop = useShop()
  const allowed = shop.can('suppliers')
  const [data, setData] = React.useState<{ suppliers: SupplierRow[]; purchases: Purchase[] } | null>(null)
  const [form, setForm] = React.useState<Form>(null)

  const load = React.useCallback(() => {
    loadSuppliers().then(setData, () => toast.error("Couldn't load suppliers"))
  }, [])
  React.useEffect(() => {
    if (allowed) load()
  }, [allowed, load])

  if (!allowed) return <OwnerOnly title="Suppliers" />
  const owed = data?.suppliers.reduce((s, x) => s + Math.max(0, x.owed), 0) ?? 0
  const name = (id: string) => data?.suppliers.find(s => s.id === id)?.name ?? ''

  return (
    <>
      <TopBar title="Suppliers" sub={'You owe ' + rs(owed)} back="/more" />
      <div className="btns">
        <button
          className="btn blue"
          onClick={() => (data?.suppliers.length ? setForm({ kind: 'purchase' }) : toast.error('Add a supplier first'))}
        >
          <Icon name="plus" />
          Record purchase
        </button>
        <button className="btn" onClick={() => setForm({ kind: 'supplier' })}>
          Add supplier
        </button>
      </div>
      {!data ? (
        <Loading />
      ) : (
        <>
          <div className="card">
            {data.suppliers.length ? (
              data.suppliers.map(s => (
                <div className="row" key={s.id}>
                  <span className="thumb">{initials(s.name)}</span>
                  <span className="t">
                    {s.name}
                    <small>
                      {s.phone || 'No phone'} · bought {rs(s.purchased)}
                    </small>
                  </span>
                  {s.owed > 0.5 ? (
                    <button className="btn sm" onClick={() => setForm({ kind: 'pay', supplier: s })}>
                      Pay {rs(s.owed)}
                    </button>
                  ) : (
                    <span className="pill g">Clear</span>
                  )}
                </div>
              ))
            ) : (
              <Empty>No suppliers yet.</Empty>
            )}
          </div>
          <div className="sec">Purchases</div>
          <div className="card">
            {data.purchases.length ? (
              data.purchases.map(p => (
                <div className="row" key={p.id}>
                  <span className="t">
                    {name(p.supplier_id)}
                    <small>
                      {fd(p.created_at)}
                      {p.note ? ' · ' + p.note : ''}
                    </small>
                  </span>
                  <span className="r">
                    {rs(p.amount)}
                    <small>paid {rs(p.paid)}</small>
                  </span>
                </div>
              ))
            ) : (
              <Empty>No purchases yet.</Empty>
            )}
          </div>
          <div className="note">Tip: use Stock → Add quantity to put the delivered items into stock.</div>
        </>
      )}
      {form?.kind === 'supplier' ? (
        <SupplierForm
          onClose={() => setForm(null)}
          onSave={async (n, phone) => {
            const ok = await shop.run(() => addSupplier(n, phone), 'Supplier added')
            if (ok !== undefined) {
              setForm(null)
              load()
            }
          }}
        />
      ) : null}
      {form?.kind === 'purchase' && data ? (
        <PurchaseForm
          suppliers={data.suppliers}
          onClose={() => setForm(null)}
          onSave={async p => {
            const ok = await shop.run(() => addPurchase(p), 'Purchase saved')
            if (ok !== undefined) {
              setForm(null)
              load()
            }
          }}
        />
      ) : null}
      {form?.kind === 'pay' ? (
        <PayForm
          supplier={form.supplier}
          onClose={() => setForm(null)}
          onSave={async (amount, mode) => {
            const ok = await shop.run(() => paySupplier(form.supplier.id, amount, mode), 'Payment saved')
            if (ok !== undefined) {
              setForm(null)
              load()
            }
          }}
        />
      ) : null}
    </>
  )
}

function SupplierForm({ onClose, onSave }: { onClose: () => void; onSave: (name: string, phone: string) => void }) {
  const [n, setN] = React.useState('')
  const [phone, setPhone] = React.useState('')
  return (
    <Sheet title="New supplier" onClose={onClose}>
      <form
        className="fg"
        onSubmit={e => {
          e.preventDefault()
          if (n.trim()) onSave(n, phone)
        }}
      >
        <label className="f full">
          Name
          <input className="in" value={n} onChange={e => setN(e.target.value)} required autoFocus />
        </label>
        <label className="f full">
          Phone
          <input className="in" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} />
        </label>
        <div className="full">
          <button className="big blue" type="submit">
            Save
          </button>
        </div>
      </form>
    </Sheet>
  )
}

function PurchaseForm({
  suppliers,
  onClose,
  onSave
}: {
  suppliers: SupplierRow[]
  onClose: () => void
  onSave: (p: { supplier_id: string; amount: number; paid: number; mode: PayMode; note: string }) => void
}) {
  const [supplierId, setSupplierId] = React.useState(suppliers[0]?.id ?? '')
  const [amount, setAmount] = React.useState('')
  const [paid, setPaid] = React.useState('0')
  const [mode, setMode] = React.useState<PayMode>('upi')
  const [note, setNote] = React.useState('')
  return (
    <Sheet title="Record purchase" onClose={onClose}>
      <form
        className="fg"
        onSubmit={e => {
          e.preventDefault()
          const a = num(amount)
          const p = Math.min(a, num(paid))
          if (a <= 0) return toast.error('Type the bill amount')
          onSave({ supplier_id: supplierId, amount: a, paid: p, mode, note: note.trim() })
        }}
      >
        <label className="f full">
          Supplier
          <select className="in" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="f">
          Bill amount ₹
          <input className="in" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} required />
        </label>
        <label className="f">
          Paid now ₹
          <input className="in" inputMode="decimal" value={paid} onChange={e => setPaid(e.target.value)} />
        </label>
        <label className="f">
          Paid by
          <select className="in" value={mode} onChange={e => setMode(e.target.value as PayMode)}>
            <option value="upi">UPI</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
          </select>
        </label>
        <label className="f">
          What came
          <input className="in" value={note} onChange={e => setNote(e.target.value)} placeholder="20 speakers" />
        </label>
        <div className="full">
          <button className="big blue" type="submit">
            Save
          </button>
        </div>
      </form>
    </Sheet>
  )
}

function PayForm({
  supplier,
  onClose,
  onSave
}: {
  supplier: SupplierRow
  onClose: () => void
  onSave: (amount: number, mode: PayMode) => void
}) {
  const [amount, setAmount] = React.useState(String(Math.round(supplier.owed)))
  const [mode, setMode] = React.useState<PayMode>('upi')
  return (
    <Sheet title="Pay supplier" onClose={onClose}>
      <span>
        You owe {supplier.name} <b>{rs(supplier.owed)}</b>
      </span>
      <form
        className="fg"
        onSubmit={e => {
          e.preventDefault()
          if (num(amount) <= 0) return toast.error('Type an amount')
          onSave(num(amount), mode)
        }}
      >
        <label className="f">
          Amount ₹
          <input className="in" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} required />
        </label>
        <label className="f">
          Paid by
          <select className="in" value={mode} onChange={e => setMode(e.target.value as PayMode)}>
            <option value="upi">UPI</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
          </select>
        </label>
        <div className="full">
          <button className="big blue" type="submit">
            Save
          </button>
        </div>
      </form>
    </Sheet>
  )
}
