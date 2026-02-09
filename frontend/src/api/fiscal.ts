import { apiRequest } from './client';
import type { FiscalPeriod, FiscalPeriodStats, FiscalDebt } from '../types';

export function listFiscalPeriods(): Promise<FiscalPeriod[]> {
  return apiRequest<FiscalPeriod[]>('/fiscal-periods');
}

export function getCurrentPeriod(): Promise<FiscalPeriod> {
  return apiRequest<FiscalPeriod>('/fiscal-periods/current');
}

export function closeFiscalPeriod(): Promise<{ closed_period_id: number; debts_created: number; new_period_id: number }> {
  return apiRequest('/fiscal-periods/close', { method: 'POST' });
}

export function getPeriodStats(periodId: number): Promise<FiscalPeriodStats> {
  return apiRequest<FiscalPeriodStats>(`/fiscal-periods/${periodId}/stats`);
}

export function getPeriodDebts(periodId: number): Promise<FiscalDebt[]> {
  return apiRequest<FiscalDebt[]>(`/fiscal-periods/${periodId}/debts`);
}

export function getMyDebts(): Promise<FiscalDebt[]> {
  return apiRequest<FiscalDebt[]>('/my/debts');
}

export function requestDebtPayment(debtId: number): Promise<FiscalDebt> {
  return apiRequest<FiscalDebt>(`/fiscal-debts/${debtId}/request-payment`, { method: 'POST' });
}

export function approveDebtPayment(debtId: number): Promise<FiscalDebt> {
  return apiRequest<FiscalDebt>(`/fiscal-debts/${debtId}/approve`, { method: 'PUT' });
}

export function rejectDebtPayment(debtId: number): Promise<FiscalDebt> {
  return apiRequest<FiscalDebt>(`/fiscal-debts/${debtId}/reject`, { method: 'PUT' });
}

export function markDebtPaid(debtId: number): Promise<FiscalDebt> {
  return apiRequest<FiscalDebt>(`/fiscal-debts/${debtId}/mark-paid`, { method: 'PUT' });
}

export function getPendingDebts(): Promise<FiscalDebt[]> {
  return apiRequest<FiscalDebt[]>('/fiscal-debts/pending');
}
