import { Asset, PerformanceData } from './types';

export const mockPositions: Asset[] = [
  {
    asset: 'VT',
    category: 'Stock ETFs',
    description: 'Total World',
    current_price: '115.42',
    average_price: '98.75',
    quantity: '245.80',
    cost: '24277.05',
    value: '28372.66',
    returns: '16.87',
    current_allocation: '32.15',
    target_allocation: '32'
  },
  {
    asset: 'VOO',
    category: 'Stock ETFs',
    description: 'Large Cap',
    current_price: '512.34',
    average_price: '478.92',
    quantity: '42.15',
    cost: '20193.58',
    value: '21595.13',
    returns: '6.94',
    current_allocation: '13.05',
    target_allocation: '13'
  },
  {
    asset: 'VO',
    category: 'Stock ETFs',
    description: 'Mid Cap',
    current_price: '278.91',
    average_price: '252.45',
    quantity: '22.35',
    cost: '5642.26',
    value: '6236.54',
    returns: '10.53',
    current_allocation: '6.12',
    target_allocation: '6'
  },
  {
    asset: 'VB',
    category: 'Stock ETFs',
    description: 'Small Cap',
    current_price: '239.81',
    average_price: '208.53',
    quantity: '18.99',
    cost: '3941.53',
    value: '4532.60',
    returns: '15.00',
    current_allocation: '10.25',
    target_allocation: '10'
  },
  {
    asset: 'VXUS',
    category: 'Stock ETFs',
    description: 'International',
    current_price: '64.89',
    average_price: '59.12',
    quantity: '31.45',
    cost: '1859.32',
    value: '2041.54',
    returns: '9.80',
    current_allocation: '2.08',
    target_allocation: '2'
  },
  {
    asset: 'VWO',
    category: 'Stock ETFs',
    description: 'Emerging',
    current_price: '45.67',
    average_price: '42.31',
    quantity: '43.21',
    cost: '1828.24',
    value: '1973.37',
    returns: '7.94',
    current_allocation: '1.95',
    target_allocation: '2'
  },
  {
    asset: 'COIN',
    category: 'Crypto Stocks',
    description: 'Coinbase',
    current_price: '189.45',
    average_price: '165.23',
    quantity: '29.87',
    cost: '4938.72',
    value: '5659.33',
    returns: '14.59',
    current_allocation: '5.12',
    target_allocation: '5'
  },
  {
    asset: 'HOOD',
    category: 'Crypto Stocks',
    description: 'Robinhood',
    current_price: '28.94',
    average_price: '24.67',
    quantity: '185.43',
    cost: '4578.16',
    value: '5367.34',
    returns: '17.24',
    current_allocation: '4.98',
    target_allocation: '5'
  },
  {
    asset: 'AAAU',
    category: 'Alternatives',
    description: 'Gold',
    current_price: '19.87',
    average_price: '18.45',
    quantity: '267.89',
    cost: '4942.97',
    value: '5322.99',
    returns: '7.69',
    current_allocation: '5.03',
    target_allocation: '5'
  },
  {
    asset: 'VNQ',
    category: 'Alternatives',
    description: 'Real Estate',
    current_price: '92.31',
    average_price: '87.12',
    quantity: '23.45',
    cost: '2042.96',
    value: '2165.07',
    returns: '5.98',
    current_allocation: '2.12',
    target_allocation: '2'
  },
  {
    asset: 'BTC',
    category: 'Crypto Tokens',
    description: 'Bitcoin',
    current_price: '58429.32',
    average_price: '45231.87',
    quantity: '0.85',
    cost: '38447.09',
    value: '49664.92',
    returns: '29.18',
    current_allocation: '12.33',
    target_allocation: '12'
  },
  {
    asset: 'ETH',
    category: 'Crypto Tokens',
    description: 'Ethereum',
    current_price: '2687.45',
    average_price: '2289.12',
    quantity: '1.23',
    cost: '2815.62',
    value: '3305.56',
    returns: '17.40',
    current_allocation: '3.05',
    target_allocation: '3'
  },
  {
    asset: 'SOL',
    category: 'Crypto Tokens',
    description: 'Solana',
    current_price: '145.67',
    average_price: '118.93',
    quantity: '23.45',
    cost: '2789.12',
    value: '3415.47',
    returns: '22.46',
    current_allocation: '2.95',
    target_allocation: '3'
  }
];

export const mockPerformanceData: PerformanceData[] = [
  {
    date: '2025-08-01',
    cost: '280000.00',
    value: '280000.00',
    returns: '0.00'
  },
  {
    date: '2025-08-02',
    cost: '285000.00',
    value: '268500.00',
    returns: '-5.79'
  },
  {
    date: '2025-08-03',
    cost: '290000.00',
    value: '263200.00',
    returns: '-9.24'
  },
  {
    date: '2025-08-04',
    cost: '295000.00',
    value: '267350.00',
    returns: '-9.37'
  },
  {
    date: '2025-08-05',
    cost: '300000.00',
    value: '291000.00',
    returns: '-3.00'
  },
  {
    date: '2025-08-06',
    cost: '305000.00',
    value: '317550.00',
    returns: '4.11'
  },
  {
    date: '2025-08-07',
    cost: '310000.00',
    value: '337700.00',
    returns: '8.94'
  },
  {
    date: '2025-08-08',
    cost: '315000.00',
    value: '361200.00',
    returns: '14.67'
  },
  {
    date: '2025-08-09',
    cost: '320000.00',
    value: '387200.00',
    returns: '21.00'
  },
  {
    date: '2025-08-10',
    cost: '325000.00',
    value: '403750.00',
    returns: '24.23'
  },
  {
    date: '2025-08-11',
    cost: '330000.00',
    value: '429000.00',
    returns: '30.00'
  }
];