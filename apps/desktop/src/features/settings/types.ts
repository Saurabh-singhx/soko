export type SettingsTabId =
  | 'general'
  | 'pairing'
  | 'tokens'
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
