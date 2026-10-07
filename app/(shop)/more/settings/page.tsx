'use client'

import * as React from 'react'
import { toast } from 'react-hot-toast'

import { addCategory, addStaff, allBills, loadMembers, removeStaff, saveSettings } from '@/lib/shop/api'
import { billNo, csv, fdt } from '@/lib/shop/format'
import type { Member } from '@/lib/shop/types'
import { useShop } from '@/components/shop/context'
import { Empty, Icon, Loading, TopBar } from '@/components/shop/ui'

function download(name: string, text: string) {
  // The BOM makes Excel read ₹ and other characters correctly.
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function SettingsPage() {
  const shop = useShop()
  const s = shop.settings
  const [form, setForm] = React.useState({
    name: s.name,
    address: s.address,
    phone: s.phone,
    owner_whatsapp: s.owner_whatsapp,
    summary_time: s.summary_time
  })
  const [members, setMembers] = React.useState<Member[] | null>(null)
  const [email, setEmail] = React.useState('')
  const [staffName, setStaffName] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [removing, setRemoving] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  const loadTeam = React.useCallback(() => {
    loadMembers().then(setMembers, () => setMembers([]))
  }, [])
  React.useEffect(() => {
    if (shop.isOwner) loadTeam()
  }, [shop.isOwner, loadTeam])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function saveShop(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Type the shop name')
    const ok = await shop.run(
      () =>
        saveSettings({
          name: form.name.trim(),
          address: form.address.trim(),
          phone: form.phone.trim(),
          owner_whatsapp: form.owner_whatsapp.trim(),
          summary_time: form.summary_time || '21:00'
        }),
      'Saved'
    )
    if (ok !== undefined) await shop.refresh()
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    const clean = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return toast.error('Type a full email address')
    const ok = await shop.run(() => addStaff(clean, staffName), 'Staff added')
    if (ok !== undefined) {
      setEmail('')
      setStaffName('')
      loadTeam()
    }
  }

  async function exportBills() {
    setBusy(true)
    const bills = await shop.run(() => allBills())
    setBusy(false)
    if (!bills) return
    const rows: (string | number)[][] = [['Bill', 'Date', 'Customer', 'Phone', 'Items', 'Total', 'Cash', 'UPI', 'Card', 'Udhaar', 'Cancelled']]
    for (const b of bills) {
      const c = shop.customer(b.customer_id)
      rows.push([
        billNo(b.no),
        fdt(b.created_at),
        c?.name ?? 'Walk-in',
        c?.phone ?? '',
        b.items.map(l => `${l.name} x${l.qty} @ ${l.price}`).join('; '),
        b.total,
        b.paid_cash,
        b.paid_upi,
        b.paid_card,
        b.due,
        b.cancelled ? 'Yes' : ''
      ])
    }
    download(`bills-${new Date().toISOString().slice(0, 10)}.csv`, csv(rows))
  }

  function exportStock() {
    const rows: (string | number)[][] = [['Product', 'Category', 'Brand', 'Code', 'Buy price', 'Sell price', 'In stock', 'Alert at', 'Warranty months', 'Fits']]
    for (const p of shop.products) {
      rows.push([
        p.name,
        shop.category(p.category_id)?.name ?? '',
        p.brand,
        p.code,
        shop.costs[p.id] ?? '',
        p.price,
        p.qty,
        p.reorder_level,
        p.warranty_months,
        p.fits
      ])
    }
    download(`stock-${new Date().toISOString().slice(0, 10)}.csv`, csv(rows))
  }

  return (
    <>
      <TopBar title="Settings" back="/more" />

      <div className="sec">Shop details</div>
      {shop.isOwner ? (
        <form className="card fg" onSubmit={saveShop}>
          <label className="f full">
            Shop name
            <input className="in" value={form.name} onChange={set('name')} />
          </label>
          <label className="f">
            Phone
            <input className="in" inputMode="tel" value={form.phone} onChange={set('phone')} />
          </label>
          <label className="f">
            Address
            <input className="in" value={form.address} onChange={set('address')} />
          </label>
          <label className="f">
            Night summary to (WhatsApp)
            <input className="in" inputMode="tel" value={form.owner_whatsapp} onChange={set('owner_whatsapp')} placeholder="Your number" />
          </label>
          <label className="f">
            Summary ready at
            <input className="in" type="time" value={form.summary_time} onChange={set('summary_time')} />
          </label>
          <div className="full">
            <button className="btn blue" type="submit">
              Save
            </button>
          </div>
        </form>
      ) : (
        <div className="card">
          <div className="row">
            <span className="t">
              {s.name}
              <small>{[s.address, s.phone].filter(Boolean).join(' · ') || 'Only the owner can change these'}</small>
            </span>
          </div>
        </div>
      )}

      {shop.isOwner ? (
        <>
          <div className="sec">Staff</div>
          <div className="card stack">
            <span className="muted" style={{ fontSize: 14 }}>
              Add a staff member&apos;s Gmail here. Then send them the website link: they tap <b>Create an account</b> with
              that same Gmail and choose a password. Staff can sell, add stock and see customers, but never buying prices
              or profit.
            </span>
            <div className="row">
              <span className={'ic ' + (s.staff_expenses ? 'g' : 'a')}>
                <Icon name="wallet" />
              </span>
              <span className="t">
                Staff can add expenses
                <small>
                  {s.staff_expenses
                    ? 'On · only you can delete'
                    : 'Off · only you can open Expenses'}
                </small>
              </span>
              <button
                className={'btn sm' + (s.staff_expenses ? '' : ' blue')}
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  const ok = await shop.run(
                    () => saveSettings({ staff_expenses: !s.staff_expenses }),
                    s.staff_expenses ? 'Expenses locked for staff' : 'Staff can now add expenses'
                  )
                  if (ok !== undefined) await shop.refresh()
                  setBusy(false)
                }}
              >
                {s.staff_expenses ? 'Turn off' : 'Turn on'}
              </button>
            </div>
            {members === null ? (
              <Loading />
            ) : (
              <div>
                {members.map(m => (
                  <div className="row" key={m.email}>
                    <span className={'ic ' + (m.role === 'owner' ? 'b' : 'a')}>
                      <Icon name={m.role === 'owner' ? 'lock' : 'users'} />
                    </span>
                    <span className="t">
                      {m.name || m.email}
                      <small>
                        {m.name ? m.email + ' · ' : ''}
                        {m.role === 'owner' ? 'Owner' : 'Staff'}
                      </small>
                    </span>
                    {m.role === 'staff' ? (
                      removing === m.email ? (
                        <span className="btns">
                          <button
                            className="btn sm red"
                            onClick={async () => {
                              const ok = await shop.run(() => removeStaff(m.email), 'Staff removed')
                              setRemoving(null)
                              if (ok !== undefined) loadTeam()
                            }}
                          >
                            Remove
                          </button>
                          <button className="btn sm" onClick={() => setRemoving(null)}>
                            Keep
                          </button>
                        </span>
                      ) : (
                        <button className="btn sm" onClick={() => setRemoving(m.email)}>
                          Remove
                        </button>
                      )
                    ) : null}
                  </div>
                ))}
              </div>
            )}
            <form className="fg" onSubmit={invite}>
              <label className="f">
                Staff Gmail
                <input className="in" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@gmail.com" />
              </label>
              <label className="f">
                Name
                <input className="in" value={staffName} onChange={e => setStaffName(e.target.value)} placeholder="optional" />
              </label>
              <div className="full">
                <button className="btn blue" type="submit">
                  <Icon name="plus" />
                  Add staff
                </button>
              </div>
            </form>
          </div>

          <div className="sec">Categories</div>
          <div className="card stack">
            <div className="chips wrap">
              {shop.categories.map(c => (
                <span className="chip" key={c.id}>
                  {c.name}
                </span>
              ))}
            </div>
            <form
              className="btns"
              onSubmit={async e => {
                e.preventDefault()
                if (!category.trim()) return
                const ok = await shop.run(
                  () => addCategory(category, shop.categories.length + 1),
                  'Category added'
                )
                if (ok !== undefined) {
                  setCategory('')
                  await shop.refresh()
                }
              }}
            >
              <input
                className="in"
                style={{ flex: 1, minWidth: 0 }}
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="New category, e.g. Seat Covers"
                aria-label="New category"
              />
              <button className="btn" type="submit">
                Add
              </button>
            </form>
          </div>

          <div className="sec">Backup</div>
          <div className="card stack">
            <span className="muted" style={{ fontSize: 14 }}>
              Download your data as Excel files (CSV). Do this every week and keep the files safe.
            </span>
            <div className="btns">
              <button className="btn" onClick={exportBills} disabled={busy}>
                <Icon name="download" />
                All bills
              </button>
              <button className="btn" onClick={exportStock}>
                <Icon name="download" />
                Stock list
              </button>
            </div>
          </div>
        </>
      ) : null}

      <div className="sec">Account</div>
      <div className="card">
        <button className="row" onClick={() => shop.openSheet({ type: 'account' })}>
          <span className="t">
            {shop.me.email}
            <small>{shop.isOwner ? 'Owner' : 'Staff'} · tap to sign out</small>
          </span>
          <span className="chev">›</span>
        </button>
      </div>
      {!shop.isOwner ? <Empty>Ask the owner if you need something changed here.</Empty> : null}
    </>
  )
}
