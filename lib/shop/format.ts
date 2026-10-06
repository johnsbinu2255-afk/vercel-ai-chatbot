import type { Bill, Customer } from '@/lib/shop/types'

export const DAY = 864e5

const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
})

export function rs(n: number | null | undefined) {
  return rupees.format(Math.round(Number(n) || 0))
}

/** Parses a number typed by a person ("1,500", "₹ 200"); empty or bad input is 0. */
export function num(v: unknown) {
  const n = parseFloat(String(v ?? '').replace(/[₹,\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function ts(value: string) {
  return new Date(value).getTime()
}

export function startOfDay(t: number) {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function fd(t: number | string) {
  return new Date(t).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

export function fdt(t: number | string) {
  return new Date(t).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit'
  })
}

export function initials(s: string) {
  return (
    String(s || '?')
      .replace(/[^A-Za-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map(w => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  )
}

/** "1 bill", "3 bills". */
export function count(n: number, word: string, plural = word + 's') {
  return `${n} ${n === 1 ? word : plural}`
}

export function billNo(no: number) {
  return 'B-' + no
}

export function payLabel(b: Bill) {
  const parts = [
    b.paid_cash ? 'Cash' : '',
    b.paid_upi ? 'UPI' : '',
    b.paid_card ? 'Card' : ''
  ].filter(Boolean)
  return parts.join(' + ') || 'Later'
}

/** A wa.me link that opens WhatsApp with the message typed in. Indian 10-digit numbers get +91. */
export function waLink(phone: string, text: string) {
  let p = String(phone || '').replace(/\D/g, '')
  if (p.length === 10) p = '91' + p
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`
}

export function billText(shop: string, b: Bill) {
  const lines = b.items
    .map(
      l =>
        `${l.name} × ${l.qty} = ${rs(l.qty * l.price)}` +
        (l.serial ? ` (S/N ${l.serial})` : '')
    )
    .join('\n')
  return (
    `${shop}\nBill ${billNo(b.no)} · ${fd(b.created_at)}\n\n${lines}\n\nTotal: ${rs(b.total)}` +
    (b.due > 0.5 ? `\nBalance: ${rs(b.due)}` : '\nPaid. Thank you!')
  )
}

export function customerLabel(c: Customer | undefined | null) {
  if (!c) return 'Walk-in'
  return c.name
}

/** Months of warranty left for an item sold at `soldAt`; -1 once it has expired. */
export function warrantyLeft(soldAt: string, months: number) {
  const end = new Date(soldAt)
  end.setMonth(end.getMonth() + months)
  const ms = end.getTime() - Date.now()
  return ms <= 0 ? -1 : Math.round(ms / (30.44 * DAY))
}

export function csv(rows: (string | number)[][]) {
  return rows
    .map(r =>
      r
        .map(v => {
          const s = String(v ?? '')
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        })
        .join(',')
    )
    .join('\n')
}
