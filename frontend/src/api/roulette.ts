import { apiRequest } from './client';

export interface RouletteBet {
  bet_type: string;
  bet_value: string;
  amount: number;
}

export interface RouletteBetResult {
  bet_type: string;
  bet_value: string;
  amount: number;
  payout: number;
}

export interface RouletteSpinResponse {
  number: number;
  color: string;
  results: RouletteBetResult[];
  total_bet: number;
  total_win: number;
  new_balance: number;
}

export interface RouletteHistory {
  id: number;
  user_id: number;
  bet_amount: number;
  win_amount: number;
  bet_data: RouletteBetResult[];
  result_number: number;
  result_color: string;
  created_at: string;
}

export interface RouletteStats {
  total_spins: number;
  total_bet: number;
  total_won: number;
  net_result: number;
  biggest_win: number;
}

export interface RouletteTopWinner {
  user_id: number;
  user_name: string;
  total_spins: number;
  total_bet: number;
  total_won: number;
  net_result: number;
}

export interface RouletteAdminStats {
  total_spins: number;
  total_bet: number;
  total_won: number;
  house_profit: number;
  actual_rtp: number;
  theoretical_rtp: number;
  top_winners: RouletteTopWinner[];
  period_start: string | null;
  period_end: string | null;
  enabled: boolean;
}

export interface RouletteStatusResponse {
  enabled: boolean;
}

export function spinRoulette(bets: RouletteBet[]): Promise<RouletteSpinResponse> {
  return apiRequest<RouletteSpinResponse>('/roulette/spin', {
    method: 'POST',
    body: JSON.stringify({ bets }),
  });
}

export function getRouletteHistory(limit: number = 50): Promise<RouletteHistory[]> {
  return apiRequest<RouletteHistory[]>(`/roulette/history?limit=${limit}`);
}

export function getRouletteStats(): Promise<RouletteStats> {
  return apiRequest<RouletteStats>('/roulette/stats');
}

export function getRouletteAdminStats(scope: 'fiscal_period' | 'all_time' = 'fiscal_period'): Promise<RouletteAdminStats> {
  return apiRequest<RouletteAdminStats>(`/roulette/admin/stats?scope=${scope}`);
}

export function getRouletteStatus(): Promise<RouletteStatusResponse> {
  return apiRequest<RouletteStatusResponse>('/roulette/status');
}

export function toggleRoulette(enabled: boolean): Promise<RouletteStatusResponse> {
  return apiRequest<RouletteStatusResponse>('/roulette/admin/toggle', {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  });
}
