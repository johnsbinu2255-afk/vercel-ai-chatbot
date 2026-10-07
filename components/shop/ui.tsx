'use client'

import * as React from 'react'
import Link from 'next/link'

import { ShopContext } from '@/components/shop/context'
import { rs, waLink } from '@/lib/shop/format'
import type { Product } from '@/lib/shop/types'

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  bill: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  box: (
    <>
      <path d="M21 8l-9-5-9 5 9 5z" />
      <path d="M3 8v8l9 5 9-5V8M12 13v8" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1.5" />
      <rect x="14" y="4" width="6" height="6" rx="1.5" />
      <rect x="4" y="14" width="6" height="6" rx="1.5" />
      <rect x="14" y="14" width="6" height="6" rx="1.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" strokeWidth="2.5" />,
  alert: (
    <>
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v4M12 17.5v.5" />
    </>
  ),
  rupee: <path d="M7 5h10M7 9h10M10 5c4 0 4 8 0 8H7l7 7" />,
  car: (
    <>
      <path d="M5 16V11l2-5h10l2 5v5" />
      <path d="M3 16h18v3H3z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </>
  ),
  scan: <path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3M8 9v6M11 9v6M14 9v6M17 9v6" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M21 20c0-3-1.7-5.3-4-5.8" />
    </>
  ),
  wrench: (
    <>
      <path d="M14.5 6.5a4 4 0 0 0 5 5L13 18a2 2 0 0 1-3-3z" />
      <path d="M14.5 6.5l3-3" />
    </>
  ),
  truck: (
    <>
      <path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" />
      <circle cx="7" cy="18" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7h15a1 1 0 0 1 1 1v11H4z" />
      <path d="M4 7l11-3v3" />
      <circle cx="16" cy="13.5" r="1" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V4M4 20h16" />
      <path d="M8 16v-4M12 16V8M16 16v-6" />
    </>
  ),
  doc: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4M9 13h6M9 17h4" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth="3" />,
  chat: <path d="M4 20l1.5-4A8 8 0 1 1 9 19.5z" />,
  back: <path d="M15 5l-7 7 7 7" strokeWidth="2.5" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  print: (
    <>
      <path d="M7 9V3h10v6" />
      <rect x="3" y="9" width="18" height="8" rx="2" />
      <path d="M7 14h10v7H7z" />
    </>
  ),
  download: <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />
}

export function Icon({ name, className }: { name: keyof typeof ICONS | string; className?: string }) {
  return (
    <svg
      className={'i' + (className ? ' ' + className : '')}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  )
}

export function TopBar({
  title,
  sub,
  back,
  right
}: {
  title: React.ReactNode
  sub?: React.ReactNode
  back?: string
  right?: React.ReactNode
}) {
  return (
    <div className="top">
      {back ? (
        <Link className="back" href={back} aria-label="Back">
          <Icon name="back" />
        </Link>
      ) : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1>{title}</h1>
        {sub ? <small>{sub}</small> : null}
      </div>
      {right === undefined ? <WhoChip /> : right}
    </div>
  )
}

/** "Owner" / "Staff" chip; tapping it shows the account sheet with Sign out. */
export function WhoChip() {
  const shop = React.useContext(ShopContext)
  if (!shop) return null
  return (
    <button
      className={'who' + (shop.isOwner ? '' : ' staff')}
      onClick={() => shop.openSheet({ type: 'account' })}
    >
      <span className="av">{shop.isOwner ? 'OW' : 'ST'}</span>
      {shop.isOwner ? 'Owner' : 'Staff'}
    </button>
  )
}

export function Sheet({
  title,
  onClose,
  children
}: {
  title: React.ReactNode
  onClose: () => void
  children: React.ReactNode
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="ov" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="grab" />
        <div className="sh">
          <h2>{title}</h2>
          <button className="x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function StockPill({ p }: { p: Product }) {
  if (p.qty === 0) return <span className="pill r">Out</span>
  if (p.qty <= p.reorder_level) return <span className="pill a">{p.qty} left</span>
  return <span className="pill g">{p.qty}</span>
}

export function WaButton({
  phone,
  text,
  label,
  className = 'btn wa'
}: {
  phone: string
  text: string
  label: string
  className?: string
}) {
  return (
    <a className={className} href={waLink(phone, text)} target="_blank" rel="noopener noreferrer">
      <Icon name="chat" />
      {label}
    </a>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>
}

export function Loading() {
  return (
    <div className="card" style={{ display: 'grid', placeItems: 'center', padding: 30 }}>
      <div className="spin" role="status" aria-label="Loading" />
    </div>
  )
}

export function OwnerOnly({ title, back = '/more' }: { title: string; back?: string }) {
  return (
    <>
      <TopBar title={title} back={back} />
      <div className="card lockbox">
        <span className="ic a" style={{ width: 56, height: 56 }}>
          <Icon name="lock" />
        </span>
        <b>Owner only</b>
        <span className="muted">
          The owner has locked this section. They can open it for staff in More → Settings → Staff access.
        </span>
      </div>
    </>
  )
}

/** Small change badge: ▲ 12% / ▼ 4% compared with the previous period. */
export function Change({ now, before }: { now: number; before: number }) {
  if (!before) return null
  const p = Math.round(((now - before) / Math.abs(before)) * 100)
  return (
    <span className={'chg ' + (p >= 0 ? 'up' : 'dn')}>
      {p >= 0 ? '▲ ' : '▼ '}
      {Math.abs(p)}%
    </span>
  )
}

export function Meter({ label, value, total, note }: { label: string; value: number; total: number; note?: string }) {
  const pct = total ? Math.min(100, Math.round((value / total) * 100)) : 0
  return (
    <div className="mrow">
      <div className="mtop">
        <span>{label}</span>
        <b>
          {rs(value)}
          {note ? <small> {note}</small> : null}
        </b>
      </div>
      <div className="meter">
        <span style={{ width: pct + '%' }} />
      </div>
    </div>
  )
}
