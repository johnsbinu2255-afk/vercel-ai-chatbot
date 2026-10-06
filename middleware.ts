import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // Create a Supabase client configured to use cookies
  const supabase = createMiddlewareClient({ req, res })

  // Refresh session if expired - required for Server Components
  // https://supabase.com/docs/guides/auth/auth-helpers/nextjs#managing-session-with-middleware
  const {
    data: { session }
  } = await supabase.auth.getSession()

  // Everyone must sign in: the shop's data is private to the owner and staff.
  if (
    !session &&
    !req.url.includes('/sign-in') &&
    !req.url.includes('/sign-up')
  ) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/sign-in'
    redirectUrl.searchParams.set(`redirectedFrom`, req.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return res
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - the icons and the web app manifest, which phones fetch before sign-in
     */
    '/((?!api|_next/static|_next/image|favicon.ico|favicon-16x16.png|apple-touch-icon.png|manifest.webmanifest).*)'
  ]
}
