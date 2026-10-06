'use client'

import * as React from 'react'
import { toast } from 'react-hot-toast'

import { addExpense, deleteExpense, loadExpenses, report } from '@/lib/shop/api'
import { DAY, fd, num, rs, startOfDay } from '@/lib/shop/format'
import type { Expense, PayMode, Report } from '@/lib/shop/types'
import { useShop } from '@/components/shop/context'
import { Empty, Icon, Loading, OwnerOnly, Sheet, TopBar } from '@/components/shop/ui'

const TYPES = ['Rent', 'Salary', 'Electricity', 'Transport', 'Tea & food', 'Repairs', 'Other']

export default function ExpensesPage() {
  const shop = useShop()
  const [list, setList] = React.useState<Expense[] | null>(null)
  const [today, setToday] = React.useState<Report | null>(null)
  const [adding, setAdding] = React.useState(false)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()

  const load = React.useCallback(() => {
    const d = startOfDay(Date.now())
    loadExpenses(monthStart, Date.now() + DAY).then(setList, () => toast.error("Couldn't load expenses"))
    report(d, d + DAY).then(setToday, () => setToday(null))
  }, [monthStart])

  React.useEffect(() => {
    if (shop.isOwner) load()
  }, [shop.isOwner, load, shop.bills])

  if (!shop.isOwner) return <OwnerOnly title="Expenses" />
  const total = list?.reduce((s, e) => s + e.amount, 0) ?? 0

  return (
    <>
      <TopBar title="Expenses" sub={'This month ' + rs(total)} back="/more" />
      <div className="card">
        <div className="sec" style={{ marginTop: 0 }}>
          Today&apos;s closing
        </div>
        {today ? (
          <>
            <div className="row">
              <span className="t">
                Cash in drawer
                <small>cash in − cash spent today</small>
              </span>
              <span className="r">{rs(today.drawer.cash)}</span>
            </div>
            <div className="row">
              <span className="t">UPI</span>
              <span className="r">{rs(today.drawer.upi)}</span>
            </div>
            <div className="row">
              <span className="t">Card</span>
              <span className="r">{rs(today.drawer.card)}</span>
            </div>
          </>
        ) : (
          <Loading />
        )}
      </div>
      <button className="btn blue" onClick={() => setAdding(true)}>
        <Icon name="plus" />
        Add expense
      </button>
      <div className="card">
        {!list ? (
          <Loading />
        ) : list.length ? (
          list.map(e => (
            <div className="row" key={e.id}>
              <span className="t">
                {e.category}
                <small>
                  {fd(e.created_at)} · {e.mode.toUpperCase()}
                  {e.note ? ' · ' + e.note : ''}
                </small>
              </span>
              <span className="r">{rs(e.amount)}</span>
              <button
                className="btn sm red"
                aria-label={'Delete ' + e.category}
                onClick={async () => {
                  const ok = await shop.run(() => deleteExpense(e.id), 'Expense deleted')
                  if (ok !== undefined) load()
                }}
              >
                ✕
              </button>
            </div>
          ))
        ) : (
          <Empty>No expenses this month.</Empty>
        )}
      </div>
      {adding ? (
        <ExpenseForm
          onClose={() => setAdding(false)}
          onSave={async e => {
            const ok = await shop.run(() => addExpense(e), 'Expense saved')
            if (ok !== undefined) {
              setAdding(false)
              load()
            }
          }}
        />
      ) : null}
    </>
  )
}

function ExpenseForm({
  onClose,
  onSave
}: {
  onClose: () => void
  onSave: (e: { category: string; amount: number; mode: PayMode; note: string }) => void
}) {
  const [category, setCategory] = React.useState(TYPES[0])
  const [amount, setAmount] = React.useState('')
  const [mode, setMode] = React.useState<PayMode>('cash')
  const [note, setNote] = React.useState('')
  return (
    <Sheet title="Add expense" onClose={onClose}>
      <form
        className="fg"
        onSubmit={e => {
          e.preventDefault()
          if (num(amount) <= 0) return toast.error('Type an amount')
          onSave({ category, amount: num(amount), mode, note: note.trim() })
        }}
      >
        <label className="f">
          Type
          <select className="in" value={category} onChange={e => setCategory(e.target.value)}>
            {TYPES.map(t => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="f">
          Amount ₹
          <input className="in" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} required autoFocus />
        </label>
        <label className="f">
          Paid by
          <select className="in" value={mode} onChange={e => setMode(e.target.value as PayMode)}>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
          </select>
        </label>
        <label className="f">
          Note
          <input className="in" value={note} onChange={e => setNote(e.target.value)} placeholder="optional" />
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
