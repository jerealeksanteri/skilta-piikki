export interface User {
  id: number;
  telegram_id: number;
  first_name: string;
  last_name: string | null;
  username: string | null;
  is_admin: boolean;
  balance: number;
  created_at: string;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  emoji: string;
  is_active: boolean;
}

export interface Transaction {
  id: number;
  user_id: number;
  product_id: number | null;
  type: 'purchase' | 'payment';
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  approved_by_id: number | null;
  note: string | null;
  created_at: string;
  product_name: string | null;
  user_name: string | null;
}
