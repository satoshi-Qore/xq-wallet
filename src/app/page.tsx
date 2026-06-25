export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center">
        <div className="mb-6 inline-flex items-center justify-center rounded-full bg-brand-100 px-4 py-1.5 text-sm font-medium text-brand-700">
          Foundation Ready
        </div>
        <h1 className="text-5xl font-bold tracking-tight">XQ Wallet</h1>
        <p className="mt-4 max-w-md text-lg text-muted-foreground" style={{ color: 'hsl(var(--muted))' }}>
          A premium, open-source, non-custodial wallet for the QoreChain ecosystem.
        </p>
        <p className="mt-2 text-sm" style={{ color: 'hsl(var(--muted))' }}>
          Project scaffold initialized — awaiting feature development.
        </p>
      </div>
    </main>
  )
}
