import { apiRequest } from './client';
import type { Product } from '../types';

export function listProducts(): Promise<Product[]> {
  return apiRequest<Product[]>('/products');
}

export function listAllProducts(): Promise<Product[]> {
  return apiRequest<Product[]>('/products/all');
}

export function createProduct(data: {
  name: string;
  price: number;
  emoji?: string;
  sort_order?: number;
}): Promise<Product> {
  return apiRequest<Product>('/products', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateProduct(
  productId: number,
  data: Partial<{ name: string; price: number; emoji: string; is_active: boolean; sort_order: number }>,
): Promise<Product> {
  return apiRequest<Product>(`/products/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteProduct(productId: number): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>(`/products/${productId}`, {
    method: 'DELETE',
  });
}
