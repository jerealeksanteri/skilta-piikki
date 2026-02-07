import { apiRequest } from './client';
import type { Product } from '../types';

export function listProducts(): Promise<Product[]> {
  return apiRequest<Product[]>('/products');
}
