export interface SecurityPaths {
  configDir: string;
  trustStorePath: string;
  certsDir: string;
  certPath: string;
  keyPath: string;
}

export interface TrustedDeviceRecord {
  id: string;
  name: string;
  model: string;
  token: string;
  refreshToken: string;
  createdAt: number;
  pairedAt: number;
  expiresAt: number;
  lastSeen: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  retryAfter: number;
  reason: string | null;
  attempts: number;
  blocked: boolean;
}

export interface RateLimitFailureResult {
  ip: string;
  attempts: number;
  retryAfter: number;
  shouldRegeneratePin: boolean;
  shouldAlert: boolean;
  alertType: string | null;
  message: string;
}

export declare class TrustStore {
  constructor(options?: { configDir?: string; legacyTransfersDir?: string });
  load(): Map<string, TrustedDeviceRecord>;
  save(): boolean;
  get(deviceId: string): TrustedDeviceRecord | undefined;
  set(deviceId: string, record: Partial<TrustedDeviceRecord>): TrustedDeviceRecord;
  delete(deviceId: string): boolean;
  has(deviceId: string): boolean;
  clear(): void;
  findByToken(token: string): TrustedDeviceRecord | null;
  findByRefreshToken(refreshToken: string): TrustedDeviceRecord | null;
  getAll(): Record<string, TrustedDeviceRecord>;
  readonly size: number;
}

export declare class RateLimiter {
  constructor(config?: Record<string, any>);
  normalizeIp(ip?: string): string;
  checkLimit(rawIp?: string): RateLimitCheckResult;
  recordFailure(rawIp?: string): RateLimitFailureResult;
  recordSuccess(rawIp?: string): void;
  onAlert(listener: (alert: RateLimitFailureResult) => void): () => void;
  reset(): void;
  destroy(): void;
}

export declare class CorsHardener {
  constructor(options?: { port?: number; getLocalIps?: () => string[] });
  setPort(port: number): void;
  isHostAllowed(hostHeader?: string): boolean;
  isOriginAllowed(origin?: string, context?: { hasValidBearerToken?: boolean }): boolean;
  getCorsHeaders(req: any, context?: any): Record<string, string>;
  handlePreflight(req: any, res: any, context?: any): boolean;
  validateRequest(req: any, res: any, context?: any): boolean;
}

export declare class TokenManager {
  constructor(trustStore: TrustStore, options?: { tokenTtlMs?: number });
  createTokenPair(): { token: string; refreshToken: string; createdAt: number; expiresAt: number };
  validateToken(token: string): { valid: boolean; expired: boolean; device: TrustedDeviceRecord | null };
  rotateToken(refreshToken: string, deviceId?: string): { success: boolean; token?: string; refreshToken?: string; expiresAt?: number; error?: string };
  revokeSession(deviceId: string): boolean;
  revokeAllSessions(): number;
  getActiveSessions(): Array<{
    deviceId: string;
    name: string;
    model: string;
    pairedAt: number;
    expiresAt: number;
    lastSeen: number;
    isExpired: boolean;
  }>;
}

export declare class TlsEngine {
  constructor(options?: { configDir?: string; getLocalIps?: () => string[] });
  initialize(): { cert: string; key: string; fingerprint: string };
  generateCertificate(): void;
  getFingerprint(): string | null;
  getCert(): string | null;
  getKey(): string | null;
  getSecureContext(): any;
  multiplexSocket(rawSocket: any, httpServer: any, httpsServer: any): void;
}

export declare const DEFAULT_TOKEN_TTL_MS: number;
export declare const DEFAULT_PORT: number;
export declare const RATE_LIMIT_CONFIG: Record<string, any>;
export declare function resolveConfigDir(): string;
export declare function ensureConfigDir(customDir?: string): string;
export declare function getSecurityPaths(customConfigDir?: string): SecurityPaths;

export declare const CRYPTO_CONSTANTS: Record<string, any>;

export declare class ReplayGuard {
  constructor(options?: { maxDriftMs?: number; windowCapacity?: number });
  checkAndRecord(deviceId: string, packetId: number, timestamp: number, nowMs?: number): { valid: boolean; reason?: string; driftMs?: number; packetId?: number; highestPacketId?: number };
  resetDevice(deviceId: string): void;
  clear(): void;
}

export declare class SasPin {
  static derive(sharedSecret: Buffer | Uint8Array): string;
  static format(pin: string): string;
  static verifyConstantTime(enteredPin: string, expectedPin: string): boolean;
}

export declare class CertFingerprint {
  static compute(cert: string | Buffer): string;
  static normalize(fp: string): string;
  static verifyConstantTime(actualFingerprint: string, pinnedFingerprint: string): boolean;
}

export declare class KeyExchange {
  static generateEphemeralKeypair(curve?: 'x25519' | 'prime256v1'): {
    curve: string;
    privateKey: any;
    publicKey: any;
    publicKeyDer: Buffer;
    publicKeyBase64: string;
    publicKeyHex: string;
  };
  static importPeerPublicKey(peerPublicKeyDer: Buffer | string): any;
  static computeSharedSecret(localPrivateKey: any, peerPublicKey: any): Buffer;
  static deriveSessionKey(sharedSecret: Buffer, options?: { salt?: string; info?: string }): Buffer;
  static deriveSessionArtifacts(sharedSecret: Buffer, options?: { mixPinInKey?: boolean; salt?: string; info?: string }): {
    sessionKey: Buffer;
    sasPin: string;
    formattedPin: string;
  };
}

export declare class EnvelopeCipher {
  constructor(sessionKey: Buffer | Uint8Array | string, options?: { replayGuard?: ReplayGuard; deviceId?: string });
  encrypt(payload: any, options?: { packetId?: number; innerType?: string }): {
    magic: string;
    version: number;
    packet_id: number;
    timestamp: number;
    packet_type: string;
    nonce: string;
    tag: string;
    ciphertext: string;
    inner_type: string | null;
  };
  decrypt(envelope: any, options?: { skipReplayCheck?: boolean; deviceId?: string }): {
    packetId: number;
    timestamp: number;
    innerType: string | null;
    payload: any;
  };
}

