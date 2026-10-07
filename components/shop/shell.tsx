'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'

import { claimOwner, loadMe, loadShop, signOut, type ShopData } from '@/lib/shop/api'
import type { Cart, Me } from '@/lib/shop/types'
import {
  emptyCart,
  friendly,
  type SheetSpec,
  type Shop,
  ShopContext
} from '@/components/shop/context'
import { SheetHost } from '@/components/shop/sheets'
import { Icon } from '@/components/shop/ui'

const TABS: [string, string, string][] = [
  ['/', 'Home', 'home'],
  ['/sell', 'Sell', 'bill'],
  ['/stock', 'Stock', 'box'],
  ['/more', 'More', 'grid']
]

const CART_KEY = 'shop-cart'

export function ShopShell({ children }: { children: React.ReactNode }) {
  const [me, setMe] = React.useState<Me | null>(null)
  const [data, setData] = React.useState<ShopData | null>(null)
  const [failed, setFailed] = React.useState<string | null>(null)
  const [cart, setCart] = React.useState<Cart>(emptyCart)
  const [sheet, setSheet] = React.useState<SheetSpec | null>(null)
  const lastLoad = React.useRef(0)
  const loads = React.useRef(0)
  const pathname = usePathname()

  const load = React.useCallback(async () => {
    lastLoad.current = Date.now()
    // When loads overlap, only the newest one may update the screen.
    const mine = ++loads.current
    try {
      const m = await loadMe()
      const shopData = m.role ? await loadShop() : null
      if (mine !== loads.current) return
      setMe(m)
      if (shopData) setData(shopData)
      setFailed(null)
    } catch (e) {
      if (mine === loads.current) setFailed(friendly(e))
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  // Pick up changes made on other phones when the app comes back to the front.
  React.useEffect(() => {
    const onShow = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoad.current > 20000) load()
    }
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [load])

  // Keep an unfinished bill if the page reloads.
  React.useEffect(() => {
    try {
      const saved = sessionStorage.getItem(CART_KEY)
      if (saved) setCart({ ...emptyCart(), ...JSON.parse(saved) })
    } catch {
      // Storage can be blocked; the bill then just starts empty.
    }
  }, [])
  React.useEffect(() => {
    try {
      sessionStorage.setItem(CART_KEY, JSON.stringify(cart))
    } catch {
      // Ignore: see above.
    }
  }, [cart])

  // Close any open sheet when moving to another screen.
  React.useEffect(() => {
    setSheet(null)
  }, [pathname])

  const shop = React.useMemo<Shop | null>(() => {
    if (!me || !me.role || !data) return null
    const byId = <T extends { id: string | number }>(list: T[]) => {
      const m = new Map<string | number, T>()
      for (const x of list) m.set(x.id, x)
      return m
    }
    const customers = byId(data.customers)
    const products = byId(data.products)
    const categories = byId(data.categories)
    return {
      ...data,
      me,
      isOwner: me.role === 'owner',
      can: area => me.role === 'owner' || (data.settings.staff_access ?? []).includes(area),
      refresh: load,
      cart,
      setCart,
      resetCart: () => setCart(emptyCart()),
      openSheet: setSheet,
      closeSheet: () => setSheet(null),
      run: async (fn, ok) => {
        try {
          const r = await fn()
          if (ok) toast.success(ok)
          // undefined means "failed", so actions without a result report success as null.
          return r === undefined ? (null as typeof r) : r
        } catch (e) {
          toast.error(friendly(e))
          return undefined
        }
      },
      customer: id => (id ? customers.get(id) : undefined),
      product: id => (id ? products.get(id) : undefined),
      category: id => (id === null || id === undefined ? undefined : categories.get(id)),
      due: id => (id ? data.dues[id]?.due ?? 0 : 0)
    }
  }, [me, data, cart, load])

  if (!me) {
    return failed ? <Problem message={failed} onRetry={load} /> : <Splash />
  }
  if (!me.role) return <Gate me={me} onDone={load} />
  if (!shop) return failed ? <Problem message={failed} onRetry={load} /> : <Splash />

  return (
    <ShopContext.Provider value={shop}>
      <main className="app">{children}</main>
      <nav className="tabs" aria-label="Main">
        {TABS.map(([href, label, icon]) => {
          const on = href === '/' ? pathname === '/' : pathname?.startsWith(href)
          return (
            <Link key={href} href={href} className={'tab' + (on ? ' on' : '')} aria-current={on ? 'page' : undefined}>
              <Icon name={icon} />
              {label}
            </Link>
          )
        })}
      </nav>
      {sheet ? <SheetHost spec={sheet} /> : null}
    </ShopContext.Provider>
  )
}

function Splash() {
  return (
    <div className="gate">
      <div className="spin" role="status" aria-label="Loading" />
    </div>
  )
}

function Problem({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="gate">
      <div className="box">
        <h1>Something went wrong</h1>
        <p>{message}</p>
        <button className="big blue" onClick={onRetry}>
          Try again
        </button>
      </div>
    </div>
  )
}

/** Shown to people who aren't in the shop yet: set up a new shop, or wait to be added. */
function Gate({ me, onDone }: { me: Me; onDone: () => Promise<void> }) {
  const router = useRouter()
  const [name, setName] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  async function leave() {
    await signOut()
    router.push('/sign-in')
    router.refresh()
  }

  if (!me.hasOwner) {
    return (
      <div className="gate">
        <form
          className="box"
          onSubmit={async e => {
            e.preventDefault()
            setBusy(true)
            try {
              await claimOwner(name || 'My Car Shop')
              toast.success('Your shop is ready')
              await onDone()
            } catch (err) {
              toast.error(friendly(err))
            }
            setBusy(false)
          }}
        >
          <div className="brand">
            <span className="ic b">
              <Icon name="box" />
            </span>
            Car Shop
          </div>
          <h1>Set up your shop</h1>
          <p>
            You will be the <b>owner</b>. Only you will see buying prices, profit and reports. You can add your
            staff afterwards in Settings.
          </p>
          <label className="f">
            Shop name
            <input className="in" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sri Car Accessories" />
          </label>
          <button className="big" type="submit" disabled={busy}>
            Set up my shop
          </button>
          <p style={{ fontSize: 13 }}>Signed in as {me.email}</p>
        </form>
      </div>
    )
  }

  return (
    <div className="gate">
      <div className="box">
        <div className="brand">
          <span className="ic a">
            <Icon name="lock" />
          </span>
          Car Shop
        </div>
        <h1>Ask the owner to add you</h1>
        <p>
          You are signed in as <b>{me.email}</b>. Ask the shop owner to add this email in{' '}
          <b>More → Settings → Staff</b>, then tap Check again.
        </p>
        <button
          className="big blue"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await onDone()
            setBusy(false)
          }}
        >
          Check again
        </button>
        <button className="btn full" onClick={leave}>
          Use a different email
        </button>
      </div>
    </div>
  )
}
