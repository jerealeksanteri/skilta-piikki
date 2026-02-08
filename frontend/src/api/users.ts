import { apiRequest } from './client';
import type { User } from '../types';

export function getMe(): Promise<User> {
  return apiRequest<User>('/me');
}

export function listUsers(): Promise<User[]> {
  return apiRequest<User[]>('/users');
}

export function getLeaderboard(): Promise<User[]> {
  return apiRequest<User[]>('/leaderboard');
}

export function createUser(data: {
  telegram_id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}): Promise<User> {
  return apiRequest<User>('/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function activateUser(userId: number): Promise<User> {
  return apiRequest<User>(`/users/${userId}/activate`, { method: 'PUT' });
}

export function deactivateUser(userId: number): Promise<User> {
  return apiRequest<User>(`/users/${userId}/deactivate`, { method: 'PUT' });
}

export function promoteUser(userId: number): Promise<User> {
  return apiRequest<User>(`/users/${userId}/promote`, { method: 'PUT' });
}

export function demoteUser(userId: number): Promise<User> {
  return apiRequest<User>(`/users/${userId}/demote`, { method: 'PUT' });
}

export function deleteAllNonAdminUsers(): Promise<{ deactivated: number }> {
  return apiRequest<{ deactivated: number }>('/users/all', { method: 'DELETE' });
}
