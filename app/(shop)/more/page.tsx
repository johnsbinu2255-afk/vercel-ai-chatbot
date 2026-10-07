'use client'

import Link from 'next/link'

import { count, rs } from '@/lib/shop/format'
import { type Shop, useShop } from '@/components/shop/context'
import { Icon, TopBar } from '@/components/shop/ui'

const TILES: [string, string, string, string, boolean, (s: Shop) => string][] = [
  ['summary', 'Night summary', 'chat', 'g', true, () => 'Today, on WhatsApp'],
  ['reports', 'Reports', 'chart', 'g', true, () => 'Day to year, profit'],
  ['bills', 'All bills', 'bill', 'b', false, s => (s.bills.length >= 200 ? '200+ bills' : count(s.bills.length, 'bill'))],
  ['customers', 'Customers', 'users', 'b', false, () => 'History, warranty'],
  [
    'udhaar',
    'Udhaar',
    'rupee',
    'a',
    false,
    s => rs(s.customers.reduce((t, c) => t + Math.max(0, s.due(c.id)), 0)) + ' due'
  ],
  ['jobs', 'Fitting jobs', 'wrench', 'g', false, s => s.jobs.length + ' open'],
  ['quotes', 'Quotations', 'doc', 'b', false, s => s.quotes.filter(q => q.status === 'open').length + ' open'],
  ['suppliers', 'Suppliers', 'truck', 'b', true, () => 'Purchases, dues'],
  ['expenses', 'Expenses', 'wallet', 'r', true, () => 'Rent, salary, closing'],
  ['settings', 'Settings', 'gear', 'b', false, () => 'Shop, staff, backup']
]

export default function MorePage() {
  const shop = useShop()
  return (
    <>
      <TopBar
        title="More"
        sub={shop.isOwner ? 'Owner view: everything unlocked' : 'Staff view: some sections are owner only'}
      />
      <div className="tiles">
        {TILES.map(([slug, label, icon, tone, ownerOnly, note]) => {
          const locked = ownerOnly && !shop.isOwner && !(slug === 'expenses' && shop.settings.staff_expenses)
          return (
            <Link className="tile" key={slug} href={'/more/' + slug}>
              <span className={'ic ' + tone}>
                <Icon name={icon} />
              </span>
              <b>{label}</b>
              <small>{locked ? 'Owner only' : note(shop)}</small>
              {locked ? (
                <span className="lk">
                  <Icon name="lock" />
                </span>
              ) : null}
            </Link>
          )
        })}
      </div>
    </>
  )
}
