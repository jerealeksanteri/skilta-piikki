import { apiRequest } from './client';
import type { Transaction } from '../types';

export function createPurchase(productId: number, quantity = 1): Promise<Transaction> {
  return apiRequest<Transaction>('/transactions/purchase', {
    method: 'POST',
    body: JSON.stringify({ product_id: productId, quantity }),
  });
}

/** The member's purchases that can still be changed or cancelled. */
export function getUndoablePurchases(): Promise<Transaction[]> {
  return apiRequest<Transaction[]>('/transactions/undoable');
}

export function setPurchaseQuantity(txId: number, quantity: number): Promise<Transaction> {
  return apiRequest<Transaction>(`/transactions/${txId}/quantity`, {
    method: 'PUT',
    body: JSON.stringify({ quantity }),
  });
}

export function cancelPurchase(txId: number): Promise<Transaction> {
  return apiRequest<Transaction>(`/transactions/${txId}/cancel`, { method: 'POST' });
}

/** Approvals and rejections that can still be undone. */
export function getRecentlyDecided(): Promise<Transaction[]> {
  return apiRequest<Transaction[]>('/transactions/recently-decided');
}

export function undoDecision(txId: number): Promise<Transaction> {
  return apiRequest<Transaction>(`/transactions/${txId}/undo-decision`, { method: 'PUT' });
}

/** Close a purchase's undo window now instead of waiting it out. */
export function settlePurchase(txId: number): Promise<Transaction> {
  return apiRequest<Transaction>(`/transactions/${txId}/settle`, { method: 'POST' });
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
