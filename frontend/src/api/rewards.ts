import { apiRequest } from './client';
import type { Reward, RewardGrant } from '../types';

export interface RewardCreateInput {
  name: string;
  description?: string;
  amount: number;
  reward_type: 'one_time' | 'recurring';
  recurrence_frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  assigned_user_ids: number[];
}

export interface RewardUpdateInput {
  name?: string;
  description?: string;
  amount?: number;
  recurrence_frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  assigned_user_ids?: number[];
  is_active?: boolean;
}

export interface GrantRewardInput {
  reward_id: number;
  user_ids: number[];
  note?: string;
}

// Reward CRUD
export function listRewards(): Promise<Reward[]> {
  return apiRequest<Reward[]>('/rewards');
}

export function getReward(id: number): Promise<Reward> {
  return apiRequest<Reward>(`/rewards/${id}`);
}

export function createReward(data: RewardCreateInput): Promise<Reward> {
  return apiRequest<Reward>('/rewards', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateReward(id: number, data: RewardUpdateInput): Promise<Reward> {
  return apiRequest<Reward>(`/rewards/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteReward(id: number): Promise<Reward> {
  return apiRequest<Reward>(`/rewards/${id}`, {
    method: 'DELETE',
  });
}

// Grant operations
export function grantReward(data: GrantRewardInput): Promise<RewardGrant[]> {
  return apiRequest<RewardGrant[]>('/rewards/grant', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function listAllGrants(limit: number = 100): Promise<RewardGrant[]> {
  return apiRequest<RewardGrant[]>(`/rewards/grants?limit=${limit}`);
}

export function listUserGrants(userId: number): Promise<RewardGrant[]> {
  return apiRequest<RewardGrant[]>(`/rewards/grants/user/${userId}`);
}
