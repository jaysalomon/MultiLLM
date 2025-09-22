/**
 * Provider factory for instantiating different provider types
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import type { 
  LLMProvider,
  APIProviderConfig,
  OllamaProviderConfig,
  LMStudioProviderConfig,
  ProviderConfig 
} from '../types/providers';
import type { ILLMProvider } from './types';
import { APIProvider } from './api/APIProvider';
import { OllamaProvider } from './ollama/OllamaProvider';
import { LMStudioProvider } from './lmstudio/LMStudioProvider';
import { ProviderError } from './errors';

/**
 * Factory class for creating provider instances
 * Requirements: 4.1, 4.4
 */
export class ProviderFactory {
  private static instances: Map<string, ILLMProvider> = new Map();

  /**
   * Create a provider instance from configuration
   * Requirements: 4.1, 4.2, 4.3
   */
  static async createProvider(config: LLMProvider): Promise<ILLMProvider> {
    // Check if instance already exists (singleton pattern for efficiency)
    if (this.instances.has(config.id)) {
      const existing = this.instances.get(config.id)!;
      // Update configuration if it has changed
      if (this.hasConfigChanged(existing, config)) {
        this.instances.delete(config.id);
      } else {
        return existing;
      }
    }

    let provider: ILLMProvider;

    switch (config.type) {
      case 'api':
        provider = new APIProvider(
          config.id,
          config.name,
          config.config as APIProviderConfig
        );
        break;

      case 'ollama':
        provider = new OllamaProvider(
          config.id,
          config.name,
          config.config as OllamaProviderConfig
        );
        break;

      case 'lmstudio':
        provider = new LMStudioProvider(
          config.id,
          config.name,
          config.config as LMStudioProviderConfig
        );
        break;

      default:
        throw new ProviderError(
          `Unknown provider type: ${(config as any).type}`,
          config.id,
          'UNKNOWN_PROVIDER_TYPE'
        );
    }

    // Validate configuration
    const validation = await provider.validateConfig();
    if (!validation.isValid) {
      throw new ProviderError(
        `Provider configuration is invalid: ${validation.errors.join(', ')}`,
        config.id,
        'INVALID_CONFIG'
      );
    }

    // Store instance for reuse
    this.instances.set(config.id, provider);
    
    return provider;
  }

  /**
   * Create multiple providers from configurations
   * Requirements: 4.1
   */
  static async createProviders(configs: LLMProvider[]): Promise<Map<string, ILLMProvider>> {
    const providers = new Map<string, ILLMProvider>();
    const errors: string[] = [];

    for (const config of configs) {
      try {
        const provider = await this.createProvider(config);
        providers.set(config.id, provider);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to create provider ${config.name}: ${errorMsg}`);
        console.error(`Failed to create provider ${config.name}:`, error);
      }
    }

    if (errors.length > 0 && providers.size === 0) {
      throw new ProviderError(
        `Failed to create any providers: ${errors.join('; ')}`,
        'factory',
        'ALL_PROVIDERS_FAILED'
      );
    }

    return providers;
  }

  /**
   * Get an existing provider instance
   * Requirements: 4.1
   */
  static getProvider(id: string): ILLMProvider | undefined {
    return this.instances.get(id);
  }

  /**
   * Remove a provider instance
   * Requirements: 4.1
   */
  static removeProvider(id: string): boolean {
    return this.instances.delete(id);
  }

  /**
   * Get all active provider instances
   * Requirements: 4.1
   */
  static getAllProviders(): Map<string, ILLMProvider> {
    return new Map(this.instances);
  }

  /**
   * Clear all provider instances
   * Requirements: 4.1
   */
  static clearAll(): void {
    this.instances.clear();
  }

  /**
   * Test all providers and return health status
   * Requirements: 4.5
   */
  static async testAllProviders(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    for (const [id, provider] of this.instances) {
      try {
        const healthCheck = await provider.healthCheck();
        results.set(id, healthCheck.healthy);
      } catch (error) {
        results.set(id, false);
      }
    }
    
    return results;
  }

  /**
   * Get supported provider types
   * Requirements: 4.1, 4.2, 4.3
   */
  static getSupportedTypes(): string[] {
    return ['api', 'ollama', 'lmstudio'];
  }

  /**
   * Validate provider configuration without creating instance
   * Requirements: 4.5
   */
  static async validateProviderConfig(config: LLMProvider): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    try {
      // Create temporary instance for validation
      const tempId = `temp-${Date.now()}`;
      const tempConfig = { ...config, id: tempId };
      
      const provider = await this.createProvider(tempConfig);
      const validation = await provider.validateConfig();
      
      // Clean up temporary instance
      this.removeProvider(tempId);
      
      return validation;
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: []
      };
    }
  }

  /**
   * Check if provider configuration has changed
   * Requirements: 4.1
   */
  private static hasConfigChanged(provider: ILLMProvider, newConfig: LLMProvider): boolean {
    // Simple deep comparison of config objects
    const oldConfig = JSON.stringify(provider.config);
    const newConfigStr = JSON.stringify(newConfig.config);
    return oldConfig !== newConfigStr;
  }

  /**
   * Get provider statistics
   * Requirements: 4.5
   */
  static getProviderStats(): {
    totalProviders: number;
    providersByType: Record<string, number>;
    healthyProviders: number;
  } {
    const stats = {
      totalProviders: this.instances.size,
      providersByType: {} as Record<string, number>,
      healthyProviders: 0
    };

    for (const provider of this.instances.values()) {
      // Count by type
      const type = provider.type;
      stats.providersByType[type] = (stats.providersByType[type] || 0) + 1;

      // Count healthy providers
      const lastHealth = provider.getLastHealthCheck?.();
      if (lastHealth?.healthy) {
        stats.healthyProviders++;
      }
    }

    return stats;
  }
}

// Export singleton instance
export const providerFactory = ProviderFactory;