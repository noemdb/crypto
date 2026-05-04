export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2 className="text-2xl font-bold">404 - Página no encontrada</h2>
      <p className="text-muted-foreground">La oportunidad que buscas no existe o ha expirado.</p>
      <a href="/" className="mt-4 text-primary hover:underline">Volver al inicio</a>
    </div>
  )
}
