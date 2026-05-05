/**
 * Next.js Instrumentation Hook
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * Se ejecuta UNA SOLA VEZ al arrancar el servidor (no en el cliente).
 * Es el lugar correcto para fijar TZ=UTC: garantiza que todas las
 * instancias de Date en el servidor serialicen en UTC, lo cual es
 * necesario para que el adaptador Neon HTTP envíe timestamps correctos
 * a PostgreSQL sin sufijos de zona horaria ambiguos.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Solo en el runtime de Node.js (no en Edge Runtime)
    process.env.TZ = "UTC";
  }
}
