import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

type Props = {
  bcvRate: number | null
  p2pMid: number | null
  premiumPct: number | null
  changePct?: number | null
}

export function BCVRateCard({ bcvRate, p2pMid, premiumPct, changePct }: Props) {
  const premiumColor =
    premiumPct === null ? '' :
    premiumPct > 8 ? 'text-green-500' :
    premiumPct > 3 ? 'text-yellow-500' : 'text-muted-foreground'

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Tasa BCV */}
      <Card>
        <CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Tasa BCV Oficial
          </p>
          <p className="text-2xl font-bold font-mono">
            {bcvRate ? `${bcvRate.toFixed(2)} VES` : '—'}
          </p>
          {changePct !== null && changePct !== undefined && (
            <p className={`text-xs mt-1 flex items-center gap-1 ${changePct > 0 ? 'text-red-400' : changePct < 0 ? 'text-green-400' : 'text-muted-foreground'}`}>
              {changePct > 0 ? <TrendingUp className="w-3 h-3" /> :
               changePct < 0 ? <TrendingDown className="w-3 h-3" /> :
               <Minus className="w-3 h-3" />}
              {changePct > 0 ? '+' : ''}{changePct.toFixed(2)}% vs ayer
            </p>
          )}
          <p className="text-[10px] text-muted-foreground mt-2">1 USD = X VES</p>
        </CardContent>
      </Card>

      {/* Precio P2P */}
      <Card>
        <CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            P2P Binance VES
          </p>
          <p className="text-2xl font-bold font-mono">
            {p2pMid ? `${p2pMid.toFixed(2)} VES` : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-2">
            Precio medio USDT/VES
          </p>
        </CardContent>
      </Card>

      {/* Premium P2P sobre BCV */}
      <Card>
        <CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Premium P2P / BCV
          </p>
          <p className={`text-2xl font-bold font-mono ${premiumColor}`}>
            {premiumPct !== null ? `+${premiumPct.toFixed(2)}%` : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-2">
            {premiumPct !== null && premiumPct > 8
              ? 'Spread alto — ventana potencial'
              : 'Diferencia P2P vs oficial'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
