import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { eventsServiceRef } from '@backstage/plugin-events-node';
import { AzureSbqConsumingEventPublisher } from '../publisher/AzureSbqConsumingEventPublisher';

/**
 * Azure SBQ module for the Events plugin.
 *
 * @alpha
 */
export const eventsModuleAzureSbqConsumingEventPublisher = createBackendModule({
  pluginId: 'events',
  moduleId: 'azure-sbq-consuming-event-publisher',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        events: eventsServiceRef,
        logger: coreServices.logger,
        scheduler: coreServices.scheduler,
      },
      async init({ config, events, logger, scheduler }) {
        const azureSbq = AzureSbqConsumingEventPublisher.fromConfig({
          config,
          events,
          logger,
          scheduler,
        });

        await azureSbq.start();
      },
    });
  },
});
