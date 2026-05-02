const financeCacheTtl = Duration(minutes: 2);
const financeOverviewCacheTag = 'finance:overview';
const financeTransactionsCacheTag = 'finance:transactions';
const financeWalletsCacheTag = 'finance:wallets';

bool isFinanceCacheFresh(DateTime fetchedAt) {
  return DateTime.now().difference(fetchedAt) < financeCacheTtl;
}
