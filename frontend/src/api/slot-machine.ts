import { apiRequest } from './client';

export interface SlotMachineSpinResponse {
  symbols: string[];
  win_amount: number;
  bet_amount: number;
  new_balance: number;
}

export interface SlotMachineHistory {
  id: number;
  user_id: number;
  bet_amount: number;
  win_amount: number;
  symbols: string[];
  created_at: string;
}

export interface SlotMachineStats {
  total_spins: number;
  total_bet: number;
  total_won: number;
  net_result: number;
  biggest_win: number;
}

export function spinSlotMachine(): Promise<SlotMachineSpinResponse> {
  return apiRequest<SlotMachineSpinResponse>('/slot-machine/spin', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function getSlotMachineHistory(limit: number = 50): Promise<SlotMachineHistory[]> {
  return apiRequest<SlotMachineHistory[]>(`/slot-machine/history?limit=${limit}`);
}

export function getSlotMachineStats(): Promise<SlotMachineStats> {
  return apiRequest<SlotMachineStats>('/slot-machine/stats');
}

export interface SlotMachineTopWinner {
  user_id: number;
  user_name: string;
  total_spins: number;
  total_bet: number;
  total_won: number;
  net_result: number;
}

export interface SlotMachineAdminStats {
  total_spins: number;
  total_bet: number;
  total_won: number;
  house_profit: number;
  actual_rtp: number;
  theoretical_rtp: number;
  top_winners: SlotMachineTopWinner[];
  period_start: string | null;
  period_end: string | null;
  enabled: boolean;
}

export interface SlotMachineStatusResponse {
  enabled: boolean;
}

export function getSlotMachineAdminStats(scope: 'fiscal_period' | 'all_time' = 'fiscal_period'): Promise<SlotMachineAdminStats> {
  return apiRequest<SlotMachineAdminStats>(`/slot-machine/admin/stats?scope=${scope}`);
}

export function getSlotMachineStatus(): Promise<SlotMachineStatusResponse> {
  return apiRequest<SlotMachineStatusResponse>('/slot-machine/status');
}

export function toggleSlotMachine(enabled: boolean): Promise<SlotMachineStatusResponse> {
  return apiRequest<SlotMachineStatusResponse>('/slot-machine/admin/toggle', {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  });
}
