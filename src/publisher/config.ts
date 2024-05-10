import { Config } from '@backstage/config';
import { Duration } from 'luxon';

export interface AzureSbqEventSourceConfig {
  connectionString: string;
  waitTimeAfterEmptyReceive: Duration;
  timeout: Duration;
}

export function readConfig(config: Config): AzureSbqEventSourceConfig {
  const azureSbq = config.getConfig(
    'events.modules.AzureSbq.azureSbqConsumingEventPublisher',
  );
  const connectionString = azureSbq.getString('connectionString');
  const timeout = Duration.fromObject({ seconds: 300 });
  const waitTimeAfterEmptyReceive = Duration.fromObject({ minutes: 1 });
  return {
    connectionString,
    waitTimeAfterEmptyReceive,
    timeout,
  };
}
