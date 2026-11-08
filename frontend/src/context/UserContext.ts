import { createContext, useContext } from 'react';
import type { User } from '../types';

export interface UserContextType {
  user: User | null;
  refreshUser: () => Promise<void>;
}

// Kept out of App.tsx: a file that exports both components and other values
// breaks React fast refresh.
export const UserContext = createContext<UserContextType>({
  user: null,
  refreshUser: async () => {},
});

export function useUser() {
  return useContext(UserContext);
}
