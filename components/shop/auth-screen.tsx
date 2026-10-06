'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { toast } from 'react-hot-toast'

import { Icon } from '@/components/shop/ui'

function message(text: string) {
  if (/invalid login credentials/i.test(text)) return 'Wrong email or password'
  if (/already registered/i.test(text)) return 'This email already has an account. Sign in instead.'
  if (/email logins are disabled|signups not allowed/i.test(text)) return 'Email sign-in is turned off in Supabase'
  if (/password should be at least/i.test(text)) return 'Use a password of at least 6 characters'
  return text
}

export function AuthScreen({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const signUp = mode === 'sign-up'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    if (signUp) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${location.origin}/api/auth/callback` }
      })
      if (error) {
        toast.error(message(error.message))
      } else if (!data.session) {
        toast.success('Check your inbox to confirm your email, then sign in.')
      } else {
        router.push('/')
        router.refresh()
        return
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) {
        toast.error(message(error.message))
      } else {
        router.push('/')
        router.refresh()
        return
      }
    }
    setBusy(false)
  }

  return (
    <div className="gate">
      <form className="box" onSubmit={submit}>
        <div className="brand">
          <span className="ic b">
            <Icon name="box" />
          </span>
          Car Shop
        </div>
        <h1>{signUp ? 'Create your account' : 'Sign in'}</h1>
        <p>
          {signUp
            ? 'Staff: use the same Gmail address the owner added for you.'
            : 'Use your email and the password you chose.'}
        </p>
        <label className="f">
          Email
          <input
            className="in"
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="f">
          Password
          <input
            className="in"
            type="password"
            autoComplete={signUp ? 'new-password' : 'current-password'}
            minLength={6}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </label>
        <button className="big blue" type="submit" disabled={busy}>
          {signUp ? 'Create account' : 'Sign in'}
        </button>
        <p style={{ textAlign: 'center' }}>
          {signUp ? 'Already have an account? ' : 'New here? '}
          <Link href={signUp ? '/sign-in' : '/sign-up'} style={{ fontWeight: 800 }}>
            {signUp ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </form>
    </div>
  )
}
