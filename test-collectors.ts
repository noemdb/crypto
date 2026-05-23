import { collectBCVRate, persistBCVRate } from './lib/intelligence/bcv-collector'
import { collectBankingSignals, persistBankingSignals } from './lib/intelligence/banking-collector'
import { calculateOpportunityContext } from './lib/intelligence/signal-engine'

async function run() {
  console.log('--- Collecting BCV Rate ---')
  const bcv = await collectBCVRate()
  console.log('BCV Data:', bcv)
  if (bcv) {
    const res = await persistBCVRate(bcv)
    console.log('Persist BCV Result:', res)
  }

  console.log('\n--- Collecting Banking Signals ---')
  const signals = await collectBankingSignals()
  console.log('Banking Signals:', signals)
  if (signals.length > 0) {
    await persistBankingSignals(signals)
    console.log('Persisted banking signals')
  }

  console.log('\n--- Context Engine ---')
  const ctx = await calculateOpportunityContext()
  console.log('Context:', ctx)
}

run().catch(console.error)
