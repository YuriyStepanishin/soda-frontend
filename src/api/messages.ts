import type {
  MessageApiResponse,
  MessageFeedbackPayload,
  MessageItem,
  SendMessagePayload,
} from '../types/message';

export async function fetchMessages(userEmail: string): Promise<MessageItem[]> {
  void userEmail;
  return [];
}

export function sendMessage(payload: SendMessagePayload) {
  void payload;
  return Promise.resolve<MessageApiResponse>({
    success: false,
    error: 'Messages API поки не реалізовано на новому бекенді.',
  });
}

export function sendFeedback(payload: MessageFeedbackPayload) {
  void payload;
  return Promise.resolve<MessageApiResponse>({
    success: false,
    error: 'Feedback API поки не реалізовано на новому бекенді.',
  });
}

export function markMessagesRead(messageIds: string[], userEmail: string) {
  void messageIds;
  void userEmail;
  return Promise.resolve<MessageApiResponse>({
    success: false,
    error: 'Mark-read API поки не реалізовано на новому бекенді.',
  });
}
