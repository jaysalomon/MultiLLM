export type ParticipantType = 'cloud' | 'ollama' | 'lmstudio' | null;

export interface ParticipantSlot {
  id: string;
  type: ParticipantType;
  model: string | null;
  name: string;
  color: string;
  isConfigured: boolean;
}
