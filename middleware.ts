import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres';

const isProtectedRoute = createRouteMatcher([
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
])

export default clerkMiddleware((auth, req) => {
    if (isProtectedRoute(req)) {
        auth().protect()
    }
})

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
        '/(api|trpc)(.*)',
    ],
}