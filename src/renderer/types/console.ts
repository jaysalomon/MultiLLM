export type ConsoleLogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface ConsoleLogEntry {
  id: string;
  level: ConsoleLogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, unknown>;
}
