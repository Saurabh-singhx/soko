export type SettingsTabId =
  | 'general'
  | 'pairing'
  | 'tokens'
  | 'cli'
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
