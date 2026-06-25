import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '404 — Not Found',
}

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Page not found</h1>
        <p className="mt-4 text-base" style={{ color: 'hsl(var(--muted))' }}>
          The page you are looking for does not exist.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          Go home
        </Link>
      </div>
    </main>
  )
}
