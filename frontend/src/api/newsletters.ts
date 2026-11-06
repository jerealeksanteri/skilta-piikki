import { apiRequest } from './client';
import type { Newsletter, NewsletterAudience, NewsletterAudienceCounts } from '../types';

export function getNewsletterAudiences(): Promise<NewsletterAudienceCounts> {
  return apiRequest<NewsletterAudienceCounts>('/admin/newsletters/audiences');
}

export function listNewsletters(): Promise<Newsletter[]> {
  return apiRequest<Newsletter[]>('/admin/newsletters');
}

export function sendNewsletter(
  audience: NewsletterAudience,
  markup: string,
  html: string,
): Promise<Newsletter> {
  return apiRequest<Newsletter>('/admin/newsletters', {
    method: 'POST',
    body: JSON.stringify({ audience, markup, html }),
  });
}
