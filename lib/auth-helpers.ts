import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'

/**
 * Para RSC (pages y layouts) — redirige a /login si no hay sesión.
 * Usar en app/(dashboard)/layout.tsx y cualquier page.tsx protegida.
 */
export async function requireAuth() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  
  const userExists = await prisma.user.findUnique({ 
    where: { id: session.user.id },
    select: { id: true }
  })
  if (!userExists) redirect('/login')

  return session
}

/**
 * Para Route Handlers (API Routes) — retorna Response 401 si no hay sesión.
 * Usar al inicio de cada POST/GET handler sensible.
 * Si retorna Response, el handler debe retornarla inmediatamente.
 * Si retorna null, la sesión es válida y se puede continuar.
 *
 * Ejemplo de uso:
 *   const unauthorized = await requireAuthApi()
 *   if (unauthorized) return unauthorized
 */
export async function requireAuthApi(): Promise<Response | null> {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return null
}

/**
 * Para Server Actions — retorna error estructurado si no hay sesión.
 * Usar al inicio de toda Server Action que mute datos.
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const session = await auth()
  return session?.user?.id ?? null
}

/**
 * Lectura simple de sesión sin redirect — para componentes que renderizan
 * contenido diferente según si hay sesión o no.
 */
export async function getSessionUser() {
  const session = await auth()
  return session?.user ?? null
}
