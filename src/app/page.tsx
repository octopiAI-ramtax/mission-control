export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Ramtax Mission Control</h1>
        <p className="text-zinc-700">
          Scaffold deployed. PR #1 establishes the Next.js baseline, CI checks, and a health endpoint.
        </p>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="font-mono text-sm">GET /healthz</p>
        </div>
      </main>
    </div>
  );
}
