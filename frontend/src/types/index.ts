export interface User {
  id: number;
  telegram_id: number;
  first_name: string;
  last_name: string | null;
  username: string | null;
  is_admin: boolean;
  is_active: boolean;
  balance: number;
  fiscal_debt_total: number;
  total_balance: number;
  created_at: string;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  emoji: string;
  is_active: boolean;
  sort_order: number;
}

export interface Transaction {
  id: number;
  user_id: number;
  product_id: number | null;
  type: 'purchase' | 'payment';
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  approved_by_id: number | null;
  created_by_id: number | null;
  created_by_name: string | null;
  quantity: number;
  note: string | null;
  created_at: string;
  product_name: string | null;
  user_name: string | null;
}

export interface FiscalPeriod {
  id: number;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface FiscalDebt {
  id: number;
  fiscal_period_id: number;
  user_id: number;
  user_name: string | null;
  amount: number;
  status: 'unpaid' | 'payment_pending' | 'paid';
  paid_at: string | null;
  created_at: string;
  period_started_at: string | null;
  period_ended_at: string | null;
}

export interface FiscalPeriodStats {
  id: number;
  started_at: string;
  ended_at: string | null;
  total_purchases: number;
  total_purchase_amount: number;
  total_payments: number;
  total_payment_amount: number;
  total_debt: number;
  debt_collected: number;
  debt_outstanding: number;
}

export interface MessageTemplate {
  id: number;
  event_type: string;
  template: string;
  is_active: boolean;
}

export interface Reward {
  id: number;
  name: string;
  description: string | null;
  amount: number;
  reward_type: 'one_time' | 'recurring';
  recurrence_frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
  assigned_user_ids: number[];
  is_active: boolean;
  next_grant_date: string | null;
  created_by_id: number;
  created_at: string;
  updated_at: string;
}

export interface RewardGrant {
  id: number;
  reward_id: number;
  user_id: number;
  user_name: string | null;
  reward_name: string;
  amount: number;
  note: string | null;
  granted_at: string;
  granted_by_scheduler: boolean;
}
