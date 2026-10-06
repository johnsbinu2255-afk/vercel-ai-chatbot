'use client'

import * as React from 'react'
import Link from 'next/link'

import { getBill } from '@/lib/shop/api'
import { billNo, billText, payLabel, rs } from '@/lib/shop/format'
import type { Bill } from '@/lib/shop/types'
import { useShop } from '@/components/shop/context'
import { Icon, Loading, WaButton } from '@/components/shop/ui'

export default function BillDonePage({ params }: { params: { id: string } }) {
  const shop = useShop()
  const fromList = shop.bills.find(b => b.id === params.id)
  const [fetched, setFetched] = React.useState<Bill | null>(null)
  const bill = fromList ?? fetched

  React.useEffect(() => {
    if (!fromList) getBill(params.id).then(setFetched, () => setFetched(null))
  }, [fromList, params.id])

  if (!bill) return <Loading />
  const cu = shop.customer(bill.customer_id)

  return (
    <>
      <div className="done">
        <span className="tick">
          <Icon name="check" />
        </span>
        <h1>Bill saved</h1>
        <p>
          {billNo(bill.no)} · {cu ? cu.name : 'Walk-in'} · {payLabel(bill)}
        </p>
        <span className="v">{rs(bill.total)}</span>
        {bill.due > 0.5 ? <span className="pill a">Udhaar {rs(bill.due)}</span> : null}
      </div>
      <WaButton
        phone={cu?.phone ?? ''}
        text={billText(shop.settings.name, bill)}
        label="Send bill on WhatsApp"
        className="btn wa full"
      />
      <button className="btn full" onClick={() => shop.openSheet({ type: 'bill', id: bill.id })}>
        View or print bill
      </button>
      <Link className="big blue" href="/sell">
        New bill
      </Link>
    </>
  )
}
