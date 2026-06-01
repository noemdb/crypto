import { getPaymentMethodChartData } from './lib/actions/monitor.actions';
import { getAuthenticatedUserId } from './lib/auth-helpers';

// Mock auth helper so we don't need a real session
jest.mock('./lib/auth-helpers', () => ({
  getAuthenticatedUserId: jest.fn().mockResolvedValue('test-user-id')
}));

async function main() {
  const data = await getPaymentMethodChartData('binance_p2p_ves', 'USDT', '24h');
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
