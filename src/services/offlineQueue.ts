const QUEUE_KEY = 'app_offline_queue_v1';

export interface QueuedOperation {
  id: string;
  collection: string;
  action: 'create' | 'update' | 'delete';
  docId?: string;
  data?: any;
  timestamp: string;
  retries: number;
}

export function addToQueue(op: Omit<QueuedOperation, 'id' | 'timestamp' | 'retries'>): string {
  const queue = getQueue();
  const entry: QueuedOperation = {
    ...op,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    retries: 0,
  };
  queue.push(entry);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return entry.id;
}

export function getQueue(): QueuedOperation[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function removeFromQueue(id: string): void {
  const queue = getQueue().filter(op => op.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

export function getQueueLength(): number {
  return getQueue().length;
}
