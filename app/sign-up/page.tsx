import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { AuthScreen } from '@/components/shop/auth-screen'

export const metadata = { title: 'Create account' }

export default async function SignUpPage() {
  const cookieStore = cookies()
  const session = await auth({ cookieStore })
  // redirect to home if user is already logged in
  if (session?.user) {
    redirect('/')
  }
  return <AuthScreen mode="sign-up" />
}
