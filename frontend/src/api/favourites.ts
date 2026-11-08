import { apiRequest } from './client';

/** Ids of the member's favourite products. Each call returns the updated list. */
export function getFavourites(): Promise<number[]> {
  return apiRequest<number[]>('/favourites');
}

export function addFavourite(productId: number): Promise<number[]> {
  return apiRequest<number[]>(`/favourites/${productId}`, { method: 'PUT' });
}

export function removeFavourite(productId: number): Promise<number[]> {
  return apiRequest<number[]>(`/favourites/${productId}`, { method: 'DELETE' });
}
