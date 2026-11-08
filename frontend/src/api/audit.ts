import { apiRequest } from './client';
import type { AuditFilters, AuditLogPage } from '../types';

export interface AuditQuery {
  actorId?: number;
  /** An exact action (`user.promote`) or a category (`user`) */
  action?: string;
  beforeId?: number;
}

export function getAuditLog(q: AuditQuery = {}): Promise<AuditLogPage> {
  const params = new URLSearchParams({ limit: '50' });
  if (q.actorId !== undefined) params.set('actor_id', String(q.actorId));
  if (q.action) params.set('action', q.action);
  if (q.beforeId !== undefined) params.set('before_id', String(q.beforeId));
  return apiRequest<AuditLogPage>(`/admin/audit-log?${params}`);
}

export function getAuditFilters(): Promise<AuditFilters> {
  return apiRequest<AuditFilters>('/admin/audit-log/filters');
}
