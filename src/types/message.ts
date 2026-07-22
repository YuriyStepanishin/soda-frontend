export type MessageAudience = 'all' | 'direct' | 'feedback';

import type { Attachment } from './photo';
export interface MessageItem {
  id: string;
  title: string;
  body: string;
  senderEmail: string;
  senderName?: string;
  recipients: string[];
  audience: MessageAudience;
  createdAt: string;
  replyToId?: string;
  requiresFeedback?: boolean;
  feedbackCount?: number;
  isRead?: boolean;
  attachments?: Attachment[];
}

export interface SendMessagePayload {
  senderEmail: string;
  senderName?: string;
  recipients: string[];
  title: string;
  body: string;
  audience: MessageAudience;
  requiresFeedback?: boolean;
  replyToId?: string;
}

export interface MessageFeedbackPayload {
  senderEmail: string;
  senderName?: string;
  targetMessageId?: string;
  feedbackText: string;
}

export interface MessageListResponse {
  data: MessageItem[];
}

export interface MessageApiResponse {
  success: boolean;
  error?: string;
}
