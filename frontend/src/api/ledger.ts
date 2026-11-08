import { apiRequest } from './client';
import type { LedgerCheck } from '../types';

export function getLedgerCheck(): Promise<LedgerCheck> {
  return apiRequest<LedgerCheck>('/admin/ledger-check');
}

export function runLedgerCheck(): Promise<LedgerCheck> {
  return apiRequest<LedgerCheck>('/admin/ledger-check', { method: 'POST' });
}
