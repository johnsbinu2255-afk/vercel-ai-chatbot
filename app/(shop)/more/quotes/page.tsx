'use client'

import { fd, rs } from '@/lib/shop/format'
import { useShop } from '@/components/shop/context'
import { Empty, TopBar } from '@/components/shop/ui'

export default function QuotesPage() {
  const shop = useShop()
  return (
    <>
      <TopBar title="Quotations" sub="Price estimates for customers" back="/more" />
      <div className="note">To make one: go to Sell, add items, then tap “Save as quotation instead”.</div>
      <div className="card">
        {shop.quotes.length ? (
          shop.quotes.map(q => (
            <button className="row" key={q.id} onClick={() => shop.openSheet({ type: 'quote', id: q.id })}>
              <span className="t">
                Q-{q.no} · {shop.customer(q.customer_id)?.name ?? 'Walk-in'}
                <small>
                  {fd(q.created_at)} · {q.items.map(l => l.name).join(', ')}
                </small>
              </span>
              <span className="r">
                {rs(q.total)}
                <small>{q.status === 'open' ? 'Open' : 'Billed'}</small>
              </span>
            </button>
          ))
        ) : (
          <Empty>No quotations yet.</Empty>
        )}
      </div>
    </>
  )
}
