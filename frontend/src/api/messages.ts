import { apiRequest } from './client';
import type { MessageTemplate } from '../types';

export function listMessageTemplates(): Promise<MessageTemplate[]> {
  return apiRequest<MessageTemplate[]>('/message-templates');
}

export function updateMessageTemplate(
  templateId: number,
  data: Partial<{ template: string; is_active: boolean }>,
): Promise<MessageTemplate> {
  return apiRequest<MessageTemplate>(`/message-templates/${templateId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
