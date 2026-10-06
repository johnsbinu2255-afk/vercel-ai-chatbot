'use client'

import { DAY, fd, initials, rs, ts } from '@/lib/shop/format'
import { useShop } from '@/components/shop/context'
import { Empty, TopBar, WaButton } from '@/components/shop/ui'

export default function UdhaarPage() {
  const shop = useShop()
  const list = shop.customers
    .map(c => ({ c, due: shop.due(c.id), since: shop.dues[c.id]?.oldest_unpaid ?? null }))
    .filter(x => x.due > 0.5)
    .sort((a, b) => b.due - a.due)
  const total = list.reduce((s, x) => s + x.due, 0)

  return (
    <>
      <TopBar title="Udhaar" sub={'Total due ' + rs(total)} back="/more" />
      {list.length ? (
        list.map(({ c, due, since }) => (
          <div className="card stack" key={c.id}>
            <div className="row" style={{ border: 0, padding: 0 }}>
              <span className="thumb">{initials(c.name)}</span>
              <span className="t">
                {c.name}
                <small>
                  {c.phone}
                  {since ? ` · since ${fd(since)} (${Math.floor((Date.now() - ts(since)) / DAY)} days)` : ''}
                </small>
              </span>
              <span className="r" style={{ color: 'var(--amber)' }}>
                {rs(due)}
              </span>
            </div>
            <div className="btns">
              <button className="btn blue sm" onClick={() => shop.openSheet({ type: 'receive', customerId: c.id })}>
                Receive money
              </button>
              {c.phone ? (
                <WaButton
                  phone={c.phone}
                  text={`Hello ${c.name}, a reminder from ${shop.settings.name}: ${rs(due)} is pending. Thank you!`}
                  label="Remind"
                  className="btn sm wa"
                />
              ) : null}
              <button className="btn sm" onClick={() => shop.openSheet({ type: 'customer', id: c.id })}>
                Bills
              </button>
            </div>
          </div>
        ))
      ) : (
        <div className="card">
          <Empty>No udhaar. Everyone has paid.</Empty>
        </div>
      )}
    </>
  )
}
