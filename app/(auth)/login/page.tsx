import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/auth/login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>
}) {
  const session = await auth()
  if (session) redirect('/dashboard')

  const { error, callbackUrl } = await searchParams
  const defaultCallbackUrl = callbackUrl ?? (process.env.NEXT_PUBLIC_APP_URL ? new URL('/dashboard', process.env.NEXT_PUBLIC_APP_URL).toString() : '/dashboard')

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/40">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="text-center space-y-3">
          {/* Brand logo */}
          <div className="flex justify-center">
            <img
              src="/aim-logo.svg"
              alt="AIM logo"
              width={72}
              height={72}
              className="drop-shadow-[0_0_18px_rgba(56,189,248,0.45)]"
            />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">AIM</h1>
            <p className="text-sm text-muted-foreground">
              Arbitrage Intelligence Monitor
            </p>
          </div>
        </div>

        {error === 'CredentialsSignin' && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
            <p className="text-sm text-destructive text-center">
              Email o contraseña incorrectos.
            </p>
          </div>
        )}

        <LoginForm callbackUrl={callbackUrl ?? '/dashboard'} />
      </div>
    </main>
  )
}
