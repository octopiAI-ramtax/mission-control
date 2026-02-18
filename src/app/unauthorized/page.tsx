import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-16">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Unauthorized</h1>
          <p className="mt-2 text-sm text-zinc-300">
            This Mission Control MVP is restricted to the ADMIN account.
          </p>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-200">
          If you believe you should have access, contact the administrator.
        </div>

        <div className="flex items-center gap-3">
          <form action="/api/logout" method="post">
            <button className="rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900">
              Sign out
            </button>
          </form>
          <Link href="/login" className="text-sm text-zinc-300 hover:text-white">
            Back to login
          </Link>
        </div>
      </main>
    </div>
  );
}
