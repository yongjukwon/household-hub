import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-[var(--canvas)] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--line2)] bg-[var(--panel)] p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          Household Hub
        </h1>
        <p className="mt-1 mb-6 text-sm text-[var(--meta)]">
          Sign in to continue
        </p>
        <LoginForm />
      </div>
    </div>
  )
}
