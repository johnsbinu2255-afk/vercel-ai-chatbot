import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { AuthScreen } from '@/components/shop/auth-screen'

export const metadata = { title: 'Sign in' }

export default async function SignInPage() {
  const cookieStore = cookies()
  const session = await auth({ cookieStore })
  // redirect to home if user is already logged in
  if (session?.user) {
    redirect('/')
  }
  return <AuthScreen mode="sign-in" />
}
