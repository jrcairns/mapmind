import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres';

const isProtectedRoute = createRouteMatcher([
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
])

export default clerkMiddleware((auth, req) => {
    if (isProtectedRoute(req)) {
        const { userId } = auth();
        if (!userId) {
            return NextResponse.redirect(new URL('/sign-in', req.url))
        }

        // const onboardingComplete = req.cookies.get('onboarding_complete')
        // if (!onboardingComplete) {
        //     return NextResponse.redirect(new URL('/onboarding', req.url))
        // }

        auth().protect()
    }
})

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
        '/(api|trpc)(.*)',
    ],
}