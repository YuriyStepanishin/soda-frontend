import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchMessages,
  markMessagesRead,
  sendFeedback,
  sendMessage,
} from '../api/messages';
import { queryKeys } from '../api/queryKeys';
import type {
  MessageFeedbackPayload,
  MessageItem,
  SendMessagePayload,
} from '../types/message';

const POLL_INTERVAL_MS = 15000;

function getReadStorageKey(userEmail: string) {
  return `messages-read:${userEmail}`;
}

function getSoundStorageKey(userEmail: string) {
  return `messages-sound:${userEmail}`;
}

function readStoredIds(userEmail: string) {
  if (!userEmail || typeof window === 'undefined') return [] as string[];

  try {
    const raw = window.localStorage.getItem(getReadStorageKey(userEmail));
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function storeReadIds(userEmail: string, ids: string[]) {
  if (!userEmail || typeof window === 'undefined') return;

  window.localStorage.setItem(
    getReadStorageKey(userEmail),
    JSON.stringify(ids)
  );
}

function readStoredSoundPreference(userEmail: string) {
  if (!userEmail || typeof window === 'undefined') return true;

  const raw = window.localStorage.getItem(getSoundStorageKey(userEmail));
  return raw !== 'off';
}

function storeSoundPreference(userEmail: string, enabled: boolean) {
  if (!userEmail || typeof window === 'undefined') return;

  window.localStorage.setItem(
    getSoundStorageKey(userEmail),
    enabled ? 'on' : 'off'
  );
}

function sortMessagesByDate(messages: MessageItem[]) {
  return [...messages].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function playIncomingMessageSound(
  audioContextRef: RefObject<AudioContext | null>
) {
  const audioContext = audioContextRef.current;
  if (!audioContext || audioContext.state !== 'running') return;

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(740, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(
    980,
    audioContext.currentTime + 0.16
  );

  gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(
    0.09,
    audioContext.currentTime + 0.02
  );
  gainNode.gain.exponentialRampToValueAtTime(
    0.0001,
    audioContext.currentTime + 0.32
  );

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.34);
}

export interface UseMessagesCenterResult {
  messages: MessageItem[];
  unreadCount: number;
  unreadIds: string[];
  soundEnabled: boolean;
  toggleSound: () => void;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  sendMessage: (
    payload: SendMessagePayload
  ) => Promise<{ success: boolean; error?: string }>;
  sendFeedback: (
    payload: MessageFeedbackPayload
  ) => Promise<{ success: boolean; error?: string }>;
  markAsRead: (messageIds: string[]) => void;
  isSendingMessage: boolean;
  isSendingFeedback: boolean;
}

export function useMessagesCenter(
  userEmail: string | null
): UseMessagesCenterResult {
  const queryClient = useQueryClient();
  const [locallyReadIds, setLocallyReadIds] = useState<string[]>(() =>
    userEmail ? readStoredIds(userEmail) : []
  );
  const [soundEnabled, setSoundEnabled] = useState(() =>
    userEmail ? readStoredSoundPreference(userEmail) : true
  );
  const previousUnreadIdsRef = useRef<string[]>([]);
  const hasFinishedFirstLoadRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!userEmail) {
      setLocallyReadIds([]);
      setSoundEnabled(true);
      return;
    }

    setLocallyReadIds(readStoredIds(userEmail));
    setSoundEnabled(readStoredSoundPreference(userEmail));
  }, [userEmail]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof AudioContext === 'undefined') {
      return;
    }

    const context = new AudioContext();
    audioContextRef.current = context;

    const unlock = () => {
      if (context.state !== 'running') {
        void context.resume();
      }
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      void context.close();
      audioContextRef.current = null;
    };
  }, []);

  const messagesQuery = useQuery({
    queryKey: queryKeys.messages(userEmail),
    queryFn: () => fetchMessages(userEmail ?? ''),
    enabled: Boolean(userEmail),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const messages = useMemo(
    () => sortMessagesByDate(messagesQuery.data ?? []),
    [messagesQuery.data]
  );

  const unreadIds = useMemo(() => {
    if (!userEmail) return [];

    const localReadSet = new Set(locallyReadIds);

    return messages
      .filter(message => message.senderEmail !== userEmail)
      .filter(message => !message.isRead)
      .filter(message => !localReadSet.has(message.id))
      .map(message => message.id);
  }, [messages, locallyReadIds, userEmail]);

  useEffect(() => {
    if (!hasFinishedFirstLoadRef.current) {
      if (messagesQuery.isSuccess) {
        hasFinishedFirstLoadRef.current = true;
        previousUnreadIdsRef.current = unreadIds;
      }
      return;
    }

    const previousUnreadIds = new Set(previousUnreadIdsRef.current);
    const hasNewUnread = unreadIds.some(id => !previousUnreadIds.has(id));

    if (hasNewUnread && soundEnabled) {
      playIncomingMessageSound(audioContextRef);
    }

    previousUnreadIdsRef.current = unreadIds;
  }, [messagesQuery.isSuccess, soundEnabled, unreadIds]);

  const markAsReadMutation = useMutation({
    mutationFn: (messageIds: string[]) => {
      if (!userEmail || messageIds.length === 0) {
        return Promise.resolve({ success: true });
      }

      return markMessagesRead(messageIds, userEmail);
    },
    onMutate: async messageIds => {
      if (!userEmail || messageIds.length === 0) return;

      const nextIds = Array.from(new Set([...locallyReadIds, ...messageIds]));
      setLocallyReadIds(nextIds);
      storeReadIds(userEmail, nextIds);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.messages(userEmail),
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: (payload: SendMessagePayload) => sendMessage(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.messages(userEmail),
      });
    },
  });

  const sendFeedbackMutation = useMutation({
    mutationFn: (payload: MessageFeedbackPayload) => sendFeedback(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.messages(userEmail),
      });
    },
  });

  function markAsRead(messageIds: string[]) {
    const ids = Array.from(new Set(messageIds.filter(Boolean)));
    if (ids.length === 0) return;
    markAsReadMutation.mutate(ids);
  }

  function toggleSound() {
    if (!userEmail) return;

    setSoundEnabled(previous => {
      const next = !previous;
      storeSoundPreference(userEmail, next);
      return next;
    });
  }

  return {
    messages,
    unreadCount: unreadIds.length,
    unreadIds,
    soundEnabled,
    toggleSound,
    isLoading: messagesQuery.isLoading,
    isFetching: messagesQuery.isFetching,
    error: messagesQuery.error,
    sendMessage: sendMessageMutation.mutateAsync,
    sendFeedback: sendFeedbackMutation.mutateAsync,
    markAsRead,
    isSendingMessage: sendMessageMutation.isPending,
    isSendingFeedback: sendFeedbackMutation.isPending,
  };
}
