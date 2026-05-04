import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  // CredentialsProvider REQUIERE strategy: 'jwt' — Auth.js no soporta
  // database sessions con credentials por seguridad.
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = LoginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { email, password } = parsed.data

        const adminEmail = process.env.ADMIN_EMAIL
        const adminHashB64 = process.env.ADMIN_PASSWORD_HASH_B64

        if (!adminEmail || !adminHashB64) {
          console.error('[auth] ADMIN_EMAIL or ADMIN_PASSWORD_HASH_B64 not configured')
          return null
        }

        if (email !== adminEmail) return null

        // Decode from base64 — avoids dotenv $-expansion issues with bcrypt hashes
        const adminHash = Buffer.from(adminHashB64, 'base64').toString('utf-8')

        const passwordMatch = await bcrypt.compare(password, adminHash)
        if (!passwordMatch) return null

        // Upsert User in DB — needed to tie UserConfig to an id in later phases
        try {
          const user = await prisma.user.upsert({
            where: { email: adminEmail },
            update: { name: 'Admin' },
            create: {
              email: adminEmail,
              name: 'Admin',
              emailVerified: new Date(),
            },
          })
          return { id: user.id, email: user.email, name: user.name }
        } catch (err) {
          console.error('[auth] prisma.user.upsert failed:', err)
          return null
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string
      return session
    },
  },
})
