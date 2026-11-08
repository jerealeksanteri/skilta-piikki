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
  type: 'purchase' | 'payment' | 'reward' | 'game' | 'adjustment';
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_by_id: number | null;
  created_by_id: number | null;
  created_by_name: string | null;
  quantity: number;
  note: string | null;
  created_at: string;
  product_name: string | null;
  user_name: string | null;
  product_emoji?: string | null;
  /** Purchases only: time left to change or cancel it, and the window's full length. */
  undo_remaining_ms?: number | null;
  undo_window_ms?: number | null;
  /** Approved / rejected by an admin: time left to undo that decision, and who made it. */
  decision_remaining_ms?: number | null;
  approved_by_name?: string | null;
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
  scheduled_for: string | null;
}

export interface SchedulerStatus {
  /** ok = ran recently without errors; failing = last run had errors;
   * stale = no run for over 2 hours; never = has not run yet */
  state: 'ok' | 'failing' | 'stale' | 'never';
  last_run_at: string | null;
  next_run_at: string | null;
  due_rewards: number;
  occurrences_granted: number;
  failed_reward_ids: number[];
}

export type TransactionStatus = Transaction['status'];

export interface ReportProductSummary {
  product_id: number | null;
  product_name: string | null;
  emoji: string | null;
  items: number;
  amount: number;
}

export interface ReportUserSummary {
  user_id: number;
  user_name: string | null;
  items: number;
  amount: number;
  products: ReportProductSummary[];
}

export interface PurchaseReport {
  start: string;
  end: string;
  statuses: TransactionStatus[];
  total_items: number;
  total_amount: number;
  user_count: number;
  by_product: ReportProductSummary[];
  by_user: ReportUserSummary[];
  transaction_count: number;
  transactions_truncated: boolean;
  transactions: Transaction[];
}

export type NewsletterAudience = 'everyone' | 'admins';

export interface Newsletter {
  id: number;
  audience: NewsletterAudience;
  markup: string;
  html: string;
  recipient_count: number;
  delivered_count: number;
  failed_count: number;
  created_by_id: number;
  created_by_name: string | null;
  created_at: string;
}

export type NewsletterAudienceCounts = Record<NewsletterAudience, number>;

export interface AuditChange {
  from: unknown;
  to: unknown;
}

export interface AuditEntry {
  id: number;
  actor_id: number | null;
  actor_name: string;
  action: string;
  target_type: string | null;
  target_id: number | null;
  target_label: string | null;
  changes: Record<string, AuditChange> | null;
  note: string | null;
  created_at: string;
}

export interface AuditLogPage {
  entries: AuditEntry[];
  has_more: boolean;
}

export interface AuditFilters {
  actors: { id: number; name: string }[];
  actions: string[];
}

export interface LedgerMismatch {
  user_id: number;
  user_name: string;
  balance: number;
  ledger_total: number;
  difference: number;
}

export interface LedgerCheck {
  /** null until the first check has run */
  checked_at: string | null;
  users_checked: number;
  mismatches: LedgerMismatch[];
}
