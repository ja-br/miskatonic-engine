import { AppConfig } from '@miskatonic/shared';
import { app } from 'electron';

/**
 * Application configuration
 */
export class AppConfigManager {
  private config: AppConfig;

  constructor() {
    this.config = {
      name: 'Miskatonic Engine',
      version: app.getVersion(),
      environment: (process.env.NODE_ENV as 'development' | 'production') || 'production',
      logLevel: process.env.LOG_LEVEL as AppConfig['logLevel'] || 'info',
    };
  }

  get(): AppConfig {
    return { ...this.config };
  }

  isDevelopment(): boolean {
    return this.config.environment === 'development';
  }

  isProduction(): boolean {
    return this.config.environment === 'production';
  }
}
