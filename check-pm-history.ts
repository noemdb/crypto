import { prisma } from './lib/db/prisma'
async function main() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const methods = ['PagoMovil','Banesco','BancoDeVenezuela','BANK','Mercantil']
  for (const pm of methods) {
    const history = await prisma.priceRecord.findMany({
      where: { platform: 'binance_p2p_ves', asset: 'USDT', paymentMethod: pm, recordedAt: { gte: since } },
      orderBy: { recordedAt: 'asc' },
      select: { recordedAt: true, priceMid: true }
    })
    console.log(pm, history.length)
    if (history.length > 0) {
      console.log(history.slice(0, Math.min(history.length, 10)).map(h => h.recordedAt.toISOString()))
    }
  }
}
main().catch(err => { console.error(err); process.exit(1) })
