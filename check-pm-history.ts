import { getPriceHistory } from './lib/db/queries/price-records'
import { PrismaClient } from '@prisma/client'
async function main() {
  const prisma = new PrismaClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const methods = ['PagoMovil','Banesco','BancoDeVenezuela','BANK','Mercantil']
  for (const pm of methods) {
    const history = await getPriceHistory({ platform: 'binance_p2p_ves', asset: 'USDT', since, paymentMethod: pm })
    console.log(pm, history.length)
    if (history.length > 0) {
      console.log(history.slice(0, 5).map(h => h.recordedAt.toISOString()))
    }
  }
  await prisma.$disconnect()
}
main().catch(err => { console.error(err); process.exit(1) })
