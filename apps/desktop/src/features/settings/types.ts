export type SettingsTabId =
  | 'general'
  | 'pairing'
  | 'tokens'
  | 'cli'
  | 'swarm'
  | 'files'
  | 'security'
  | 'mascot'
  | 'updates';

export interface SettingsTabItem {
  id: SettingsTabId;
  label: string;
  iconName: string;
  badge?: string;
}
