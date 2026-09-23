import { identityService, IdentityService } from './IdentityService';

class SafeServiceRegistry {
  private static instance: SafeServiceRegistry;

  public static getInstance(): SafeServiceRegistry {
    if (!SafeServiceRegistry.instance) {
      SafeServiceRegistry.instance = new SafeServiceRegistry();
    }
    return SafeServiceRegistry.instance;
  }

  // Self-healing accessor: Guaranteed to return a valid instance, never undefined
  public get identity(): IdentityService {
    if (identityService) return identityService;
    console.warn('[Self-Healing] identityService was uninitialized. Creating emergency fallback.');
    return new IdentityService();
  }
}

export const services = SafeServiceRegistry.getInstance();
