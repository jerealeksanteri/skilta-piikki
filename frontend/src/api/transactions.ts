import { apiRequest } from './client';
import type { Transaction } from '../types';

export function createPurchase(productId: number, quantity = 1): Promise<Transaction> {
  return apiRequest<Transaction>('/transactions/purchase', {
    method: 'POST',
    body: JSON.stringify({ product_id: productId, quantity }),
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

export function createPaymentRequest(
  amount: number,
  note?: string,
): Promise<Transaction> {
  return apiRequest<Transaction>('/transactions/payment-request', {
    method: 'POST',
    body: JSON.stringify({ amount, note }),
  });
}

/** The latest 50; slot machine spins only when includeGames is set. */
export function getMyTransactions(includeGames = false): Promise<Transaction[]> {
  return apiRequest<Transaction[]>(`/transactions/mine${includeGames ? '?include_games=true' : ''}`);
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
