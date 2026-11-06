/**
 * @file index.d.ts
 * TypeScript declarations for @soko/discovery
 */

export interface PairingOptions {
  host: string;
  port?: number | string;
  pin: string;
  fingerprint?: string;
  name?: string;
  tls?: boolean;
}

export interface PairingPayloadResult {
  uri: string;
  webUrl: string;
  qrPayload: string;
  pin: string;
  formattedPin: string;
}

export interface ParsedPairingPayload {
  valid: boolean;
  host: string | null;
  port: number;
  pin: string | null;
  formattedPin: string | null;
  fingerprint: string | null;
  name: string | null;
  tls: boolean;
  error?: string;
}

export interface QrOptions {
  size?: number;
  margin?: number;
  darkColor?: string;
  lightColor?: string;
  ecLevel?: 'L' | 'M';
  maskPattern?: number;
}

export interface MdnsAdvertiserOptions {
  port?: number;
  name?: string;
  version?: string;
  tls?: boolean;
  certFingerprint?: string;
  ips?: string[];
}

export class MdnsAdvertiser {
  port: number;
  name: string;
  hostname: string;
  version: string;
  tls: boolean;
  certFingerprint: string;
  ips: string[];
  isRunning: boolean;

  constructor(options?: MdnsAdvertiserOptions);
  start(): Promise<boolean>;
  updateAttributes(updates?: Partial<MdnsAdvertiserOptions>): void;
  stop(): void;
}

export function generateQrMatrix(text: string, options?: QrOptions): boolean[][];
export function generateQrSvg(text: string, options?: QrOptions): string;
export function generateQrDataUrl(text: string, options?: QrOptions): string;

export function createPairingPayload(options: PairingOptions): PairingPayloadResult;
export function parsePairingPayload(input: string): ParsedPairingPayload;

export function buildDiscoveryMetadata(context?: any): Record<string, any>;
export function handleDiscoveryHttpRequest(req: any, res: any, context?: any): boolean;
export function getLocalIpv4Addresses(): string[];

export type PairingModeType = 'web' | 'native' | 'wifi';

export interface UniversalQrOptions {
  host?: string;
  port?: number | string;
  pin: string;
  fingerprint?: string;
  name?: string;
  tls?: boolean;
  mode?: PairingModeType;
  ttlSeconds?: number;
  alts?: string | string[];
  wifiSsid?: string;
  wifiPassword?: string;
  wifiAuthType?: 'WPA' | 'WEP' | 'nopass';
  qrOptions?: QrOptions;
}

export interface UniversalQrResult {
  qrPayload: string;
  webUrl: string;
  nativeUri: string;
  wifiString: string | null;
  pin: string;
  formattedPin: string;
  expiresAt: number;
  ttlSeconds: number;
  mode: string;
  primaryIp: string;
  candidateIps: string[];
  alts: string;
  svg: string;
}

export interface ParsedUniversalQrPayload {
  valid: boolean;
  mode: 'web' | 'native' | 'wifi' | 'pin' | 'unknown';
  host: string | null;
  port: number;
  pin: string | null;
  formattedPin: string | null;
  fingerprint: string | null;
  name: string | null;
  tls: boolean;
  expiresAt: number | null;
  isExpired: boolean;
  remainingSeconds: number | null;
  alts: string[];
  candidateIps: string[];
  wifi?: { ssid: string; password?: string; authType?: string };
  error?: string;
}

export interface ResolvedInterfaces {
  primaryIp: string;
  primaryInterface: string | null;
  candidateIps: string[];
  alts: string;
  allInterfaces: Array<{ name: string; address: string; type: string; priority: number }>;
}

export function buildUniversalQrPayload(options: UniversalQrOptions): UniversalQrResult;
export function parseUniversalQrPayload(input: string): ParsedUniversalQrPayload;
export function resolveNetworkInterfaces(options?: { includeVirtual?: boolean; preferredIp?: string }): ResolvedInterfaces;
export function validateQrSecurity(parsed: ParsedUniversalQrPayload, options?: { activeSasPin?: string; activeCertFingerprint?: string }): { authorized: boolean; code: string; reason?: string };

