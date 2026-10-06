'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { setJobStatus } from '@/lib/shop/api'
import { fdt, rs } from '@/lib/shop/format'
import type { Job } from '@/lib/shop/types'
import { emptyCart, useShop } from '@/components/shop/context'
import { newLineKey } from '@/components/shop/sheets'
import { Empty, Icon, TopBar, WaButton } from '@/components/shop/ui'

const STATUS: Record<Exclude<Job['status'], 'billed'>, [string, string]> = {
  waiting: ['Waiting', 'a'],
  working: ['Working', 'b'],
  ready: ['Ready', 'g']
}

export default function JobsPage() {
  const shop = useShop()
  const router = useRouter()
  const [filter, setFilter] = React.useState<'all' | Job['status']>('all')
  const list = shop.jobs.filter(j => filter === 'all' || j.status === filter)

  async function next(j: Job) {
    const status = j.status === 'waiting' ? 'working' : 'ready'
    const ok = await shop.run(() => setJobStatus(j.id, status), status === 'ready' ? 'Car is ready' : 'Work started')
    if (ok !== undefined) await shop.refresh()
  }

  function bill(j: Job) {
    shop.setCart({
      ...emptyCart(),
      customerId: j.customer_id,
      jobId: j.id,
      lines: [
        {
          key: newLineKey(),
          product_id: null,
          name: 'Fitting · ' + j.work,
          qty: 1,
          price: j.labour,
          serial: '',
          warranty_months: 0
        }
      ]
    })
    router.push('/sell')
  }

  return (
    <>
      <TopBar title="Fitting jobs" sub="Cars in the shop for fitting" back="/more" />
      <button className="btn blue" onClick={() => shop.openSheet({ type: 'newJob' })}>
        <Icon name="plus" />
        New job
      </button>
      <div className="chips">
        {(['all', 'waiting', 'working', 'ready'] as const).map(f => (
          <button key={f} className={'chip' + (filter === f ? ' on' : '')} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : STATUS[f][0]}
          </button>
        ))}
      </div>
      {list.length ? (
        list.map(j => {
          const cu = shop.customer(j.customer_id)
          const [label, tone] = STATUS[j.status as keyof typeof STATUS] ?? ['Billed', 'n']
          return (
            <div className="card stack" key={j.id}>
              <div className="row" style={{ border: 0, padding: 0 }}>
                <span className={'ic ' + tone}>
                  <Icon name="car" />
                </span>
                <span className="t">
                  {j.car_no}
                  {j.model ? ' · ' + j.model : ''}
                  <small>{j.work}</small>
                </span>
                <span className={'pill ' + tone}>{label}</span>
              </div>
              <span className="muted" style={{ fontSize: 13 }}>
                {cu ? cu.name : 'Walk-in'}
                {j.tech ? ' · ' + j.tech : ''} · fitting {rs(j.labour)} · {fdt(j.created_at)}
              </span>
              <div className="btns">
                {j.status !== 'ready' ? (
                  <button className="btn sm blue" onClick={() => next(j)}>
                    {j.status === 'waiting' ? 'Start work' : 'Car is ready'}
                  </button>
                ) : (
                  <>
                    <button className="btn sm blue" onClick={() => bill(j)}>
                      Make bill
                    </button>
                    {cu?.phone ? (
                      <WaButton
                        phone={cu.phone}
                        text={`Hello ${cu.name}, your ${j.model || 'car'} (${j.car_no}) is ready for pickup. - ${shop.settings.name}`}
                        label="Tell customer"
                        className="btn sm wa"
                      />
                    ) : null}
                  </>
                )}
              </div>
            </div>
          )
        })
      ) : (
        <div className="card">
          <Empty>No jobs here.</Empty>
        </div>
      )}
    </>
  )
}
