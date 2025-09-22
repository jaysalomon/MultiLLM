import * as crypto from 'crypto';
import { app, safeStorage } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { logger } from '../utils/Logger';

/**
 * Secure configuration service for storing sensitive data
 * Requirements: 4.1, 4.4 - Security for API keys and credentials
 */
export class SecureConfigService {
  private configPath: string;
  private encryptionAvailable: boolean;
  private configCache: Map<string, any> = new Map();

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'secure-config.json');
    this.encryptionAvailable = safeStorage.isEncryptionAvailable();

    if (!this.encryptionAvailable) {
      logger.warn('OS keychain encryption not available, using fallback encryption');
    }
  }

  /**
   * Store a secure configuration value
   */
  async setSecureValue(key: string, value: string): Promise<void> {
    try {
      let encrypted: string;

      if (this.encryptionAvailable) {
        // Use OS keychain encryption
        const buffer = safeStorage.encryptString(value);
        encrypted = buffer.toString('base64');
      } else {
        // Fallback to AES encryption with machine-specific key
        encrypted = this.fallbackEncrypt(value);
      }

      // Store encrypted value
      const config = await this.loadConfig();
      config[key] = {
        encrypted,
        timestamp: new Date().toISOString(),
        method: this.encryptionAvailable ? 'keychain' : 'fallback'
      };

      await this.saveConfig(config);
      this.configCache.set(key, value);

      logger.info('Secure value stored', { key, method: config[key].method });
    } catch (error) {
      logger.error('Failed to store secure value', { key }, error as Error);
      throw new Error(`Failed to store secure configuration: ${error}`);
    }
  }

  /**
   * Retrieve a secure configuration value
   */
  async getSecureValue(key: string): Promise<string | null> {
    try {
      // Check cache first
      if (this.configCache.has(key)) {
        return this.configCache.get(key);
      }

      const config = await this.loadConfig();
      const entry = config[key];

      if (!entry) {
        return null;
      }

      let decrypted: string;

      if (entry.method === 'keychain' && this.encryptionAvailable) {
        const buffer = Buffer.from(entry.encrypted, 'base64');
        decrypted = safeStorage.decryptString(buffer);
      } else {
        decrypted = this.fallbackDecrypt(entry.encrypted);
      }

      this.configCache.set(key, decrypted);
      return decrypted;
    } catch (error) {
      logger.error('Failed to retrieve secure value', { key }, error as Error);
      return null;
    }
  }

  /**
   * Remove a secure configuration value
   */
  async removeSecureValue(key: string): Promise<void> {
    try {
      const config = await this.loadConfig();
      delete config[key];
      await this.saveConfig(config);
      this.configCache.delete(key);

      logger.info('Secure value removed', { key });
    } catch (error) {
      logger.error('Failed to remove secure value', { key }, error as Error);
    }
  }

  /**
   * Store provider configuration securely
   */
  async storeProviderConfig(providerId: string, config: any): Promise<void> {
    const sanitized = { ...config };

    // Identify and encrypt sensitive fields
    const sensitiveFields = ['apiKey', 'apiSecret', 'token', 'password', 'clientSecret'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        const secureKey = `provider_${providerId}_${field}`;
        await this.setSecureValue(secureKey, sanitized[field]);
        // Replace with reference
        sanitized[field] = `SECURE:${secureKey}`;
      }
    }

    // Store non-sensitive config
    const configKey = `provider_config_${providerId}`;
    const allConfig = await this.loadConfig();
    allConfig[configKey] = sanitized;
    await this.saveConfig(allConfig);
  }

  /**
   * Retrieve provider configuration with decrypted values
   */
  async getProviderConfig(providerId: string): Promise<any | null> {
    try {
      const configKey = `provider_config_${providerId}`;
      const allConfig = await this.loadConfig();
      const config = allConfig[configKey];

      if (!config) {
        return null;
      }

      const decrypted = { ...config };

      // Decrypt sensitive fields
      for (const [key, value] of Object.entries(decrypted)) {
        if (typeof value === 'string' && value.startsWith('SECURE:')) {
          const secureKey = value.substring(7);
          const decryptedValue = await this.getSecureValue(secureKey);
          decrypted[key] = decryptedValue;
        }
      }

      return decrypted;
    } catch (error) {
      logger.error('Failed to retrieve provider config', { providerId }, error as Error);
      return null;
    }
  }

  /**
   * Validate URL to prevent SSRF attacks
   */
  static validateUrl(url: string): { valid: boolean; error?: string } {
    try {
      const parsed = new URL(url);

      // Block local/internal addresses
      const blockedHosts = [
        '0.0.0.0',
        '127.0.0.1',
        'localhost',
        '169.254.169.254', // AWS metadata endpoint
        '::1',
        '::ffff:127.0.0.1'
      ];

      if (blockedHosts.some(host => parsed.hostname.includes(host))) {
        // Allow localhost only for Ollama and LM Studio
        if (!url.includes('11434') && !url.includes('1234')) {
          return { valid: false, error: 'Internal addresses are not allowed' };
        }
      }

      // Only allow HTTP(S) protocols
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { valid: false, error: 'Only HTTP/HTTPS protocols are allowed' };
      }

      // Block file:// protocol
      if (parsed.protocol === 'file:') {
        return { valid: false, error: 'File protocol is not allowed' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Invalid URL format' };
    }
  }

  /**
   * Clear all secure configuration
   */
  async clearAll(): Promise<void> {
    try {
      await fs.unlink(this.configPath);
      this.configCache.clear();
      logger.info('All secure configuration cleared');
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        logger.error('Failed to clear secure configuration', {}, error as Error);
      }
    }
  }

  /**
   * Load configuration from disk
   */
  private async loadConfig(): Promise<Record<string, any>> {
    try {
      const data = await fs.readFile(this.configPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return {};
      }
      throw error;
    }
  }

  /**
   * Save configuration to disk
   */
  private async saveConfig(config: Record<string, any>): Promise<void> {
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
  }

  /**
   * Fallback encryption using machine-specific key
   */
  private fallbackEncrypt(value: string): string {
    const key = this.getMachineKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Fallback decryption
   */
  private fallbackDecrypt(encrypted: string): string {
    const key = this.getMachineKey();
    const [ivHex, encryptedData] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Get machine-specific encryption key
   */
  private getMachineKey(): Buffer {
    // Use machine ID + app name as key basis
    const machineId = require('os').hostname() + process.platform;
    const appId = 'multi-llm-chat-v1';
    const combined = machineId + appId;

    return crypto.createHash('sha256').update(combined).digest();
  }

  /**
   * Export configuration (without sensitive data)
   */
  async exportConfig(): Promise<Record<string, any>> {
    const config = await this.loadConfig();
    const exported: Record<string, any> = {};

    for (const [key, value] of Object.entries(config)) {
      // Skip encrypted entries
      if (value && typeof value === 'object' && value.encrypted) {
        exported[key] = { type: 'encrypted', timestamp: value.timestamp };
      } else if (key.startsWith('provider_config_')) {
        // Sanitize provider configs
        const sanitized = { ...value };
        for (const field of Object.keys(sanitized)) {
          if (typeof sanitized[field] === 'string' && sanitized[field].startsWith('SECURE:')) {
            sanitized[field] = '[REDACTED]';
          }
        }
        exported[key] = sanitized;
      } else {
        exported[key] = value;
      }
    }

    return exported;
  }
}

// Export singleton instance
export const secureConfig = new SecureConfigService();