export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  action: string;
  details?: string;
  userId?: string;
  projectId?: string;
  projectName?: string;
  itemId?: string;
  itemName?: string;
  msg?: string;
  author?: string;
  type?: string;
  createdAt?: string;
}
