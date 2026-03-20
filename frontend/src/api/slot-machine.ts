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
