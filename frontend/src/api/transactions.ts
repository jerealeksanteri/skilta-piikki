import { apiRequest } from './client';
import type { Transaction } from '../types';

export function createPurchase(productId: number): Promise<Transaction> {
  return apiRequest<Transaction>('/transactions/purchase', {
    method: 'POST',
    body: JSON.stringify({ product_id: productId }),
  });
}

export function createPayment(
  userId: number,
  amount: number,
  note?: string,
): Promise<Transaction> {
  return apiRequest<Transaction>('/transactions/payment', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, amount, note }),
  });
}

export function getMyTransactions(): Promise<Transaction[]> {
  return apiRequest<Transaction[]>('/transactions/mine');
}

export function getPendingTransactions(): Promise<Transaction[]> {
  return apiRequest<Transaction[]>('/transactions/pending');
}

export function approveTransaction(txId: number): Promise<Transaction> {
  return apiRequest<Transaction>(`/transactions/${txId}/approve`, {
    method: 'PUT',
  });
}

export function rejectTransaction(txId: number): Promise<Transaction> {
  return apiRequest<Transaction>(`/transactions/${txId}/reject`, {
    method: 'PUT',
  });
}
