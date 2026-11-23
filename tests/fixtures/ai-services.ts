import type { AiServices } from '../../src/server/ai/services.ts';
import type { AiProvider } from '../../src/server/ai/provider.ts';
import type { ProviderId, ProviderSelection, ProviderView } from '../../src/shared/ai-account.ts';

const NO_SELECTION: ProviderSelection = { model: null, effort: null };

/**
 * Builds the AI services for a test from two providers. The account and settings parts are
 * stubs: tests that need them build their own services.
 */
export function testServices(
  providers: Record<ProviderId, AiProvider>,
  defaultProvider: ProviderId = 'claude',
): AiServices {
  const unused = async (): Promise<never> => {
    throw new Error('Account services are not configured in this test.');
  };
  const account = {
    view: unused as () => Promise<ProviderView>,
    models: unused,
    startLogin: unused,
    submitLoginCode: unused,
    currentLogin: () => null,
    cancelLogin: async () => null,
  };
  return {
    settings: {
      snapshot: () => ({
        defaultProvider,
        selections: { claude: NO_SELECTION, codex: NO_SELECTION },
      }),
      setDefault: unused as () => never,
      setSelection: unused as () => never,
    },
    providers,
    accounts: { claude: account, codex: account },
    currentDefault: () => defaultProvider,
    close: () => undefined,
  };
}
