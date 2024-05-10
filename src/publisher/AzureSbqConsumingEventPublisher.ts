import {
  ServiceBusClient,
  parseServiceBusConnectionString,
} from '@azure/service-bus';
import { LoggerService } from '@backstage/backend-plugin-api';
import { PluginTaskScheduler } from '@backstage/backend-tasks';
import { Config } from '@backstage/config';
import { EventsService } from '@backstage/plugin-events-node';

import { AzureSbqEventSourceConfig, readConfig } from './config';

/**
 * Publishes events received from an Azure Service Bus queue.
 * The message payload will be used as event payload and passed to registered subscribers.
 *
 * @public
 */
export class AzureSbqConsumingEventPublisher {
  private readonly sbClient: ServiceBusClient;
  private readonly queue: string | undefined;
  private readonly taskTimeoutSeconds: number;
  private readonly waitTimeAfterEmptyReceiveMs;
  static fromConfig(env: {
    config: Config;
    events: EventsService;
    logger: LoggerService;
    scheduler: PluginTaskScheduler;
  }): AzureSbqConsumingEventPublisher {
    const config = readConfig(env.config);
    return new AzureSbqConsumingEventPublisher(
      env.logger,
      env.events,
      env.scheduler,
      config,
    );
  }

  private constructor(
    private readonly logger: LoggerService,
    private readonly events: EventsService,
    private readonly scheduler: PluginTaskScheduler,
    config: AzureSbqEventSourceConfig,
  ) {
    console.log(config.connectionString);
    this.sbClient = new ServiceBusClient(config.connectionString);
    const parsedConnectionString = parseServiceBusConnectionString(
      config.connectionString,
    );
    const queueName = parsedConnectionString.entityPath;
    this.queue = queueName;
    this.taskTimeoutSeconds = config.timeout.as('seconds');
    this.waitTimeAfterEmptyReceiveMs =
      config.waitTimeAfterEmptyReceive.as('milliseconds');
  }

  async start(): Promise<void> {
    const id = `events.azureSbq.publisher:${this.queue}`;
    const logger = this.logger.child({
      class: AzureSbqConsumingEventPublisher.prototype.constructor.name,
      taskId: id,
    });

    await this.scheduler.scheduleTask({
      id: id,
      frequency: { seconds: 0 },
      timeout: { seconds: this.taskTimeoutSeconds },
      scope: 'local',
      fn: async () => {
        try {
          const numMessages = await this.consumeMessages();
          if (numMessages === 0) {
            await this.sleep(this.waitTimeAfterEmptyReceiveMs);
          }
        } catch (error: any) {
          logger.error('Failed to consume Azure SBQ messages', error);
        }
      },
    });
  }

  private async consumeMessages(): Promise<number> {
    try {
      if (this.queue) {
        const receiver = this.sbClient.createReceiver(this.queue);
        const data = await receiver.receiveMessages(10);

        data?.forEach(async message => {
          const eventPayload = message.body;
          console.log('eventPayload', eventPayload);

          const metadata: Record<string, string | string[]> = {};
          metadata['X-GitHub-Event'] = 'push';
          this.events.publish({
            topic: 'github',
            eventPayload,
            metadata,
          });
          receiver.completeMessage(message);
        });
        return data?.length ?? 0;
      }
      return 0;
    } catch (error: any) {
      this.logger.error(
        `Failed to receive events from Azure SBQ ${this.queue}`,
        error,
      );
      return 0;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
  }
}
