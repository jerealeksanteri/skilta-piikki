import { apiRequest } from './client';
import type { PurchaseReport, TransactionStatus } from '../types';

export function getPurchaseReport(
  start: Date,
  end: Date,
  statuses: TransactionStatus[],
): Promise<PurchaseReport> {
  const params = new URLSearchParams({
    start: start.toISOString(),
    end: end.toISOString(),
  });
  statuses.forEach((s) => params.append('status', s));
  return apiRequest<PurchaseReport>(`/admin/reports/purchases?${params.toString()}`);
}
