import { connect } from './libs/connect';
import { processEvent, processExit } from './libs/helper/process';

import { loggerType } from './libs/types';

export default async function(
  log: loggerType,
  url: string,
  prefetch: number = 1,
  signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGKILL', 'SIGUSR1', 'SIGUSR2'],
) {
  const instance = await connect(
    log,
    url,
    prefetch,
  );

  instance.on('close', async () => {
    log.info('[AMQP] Application has been shut down.');

    await processExit(0);
  });

  processEvent(signals, async (params) => {
    try {
      log.info(params, '[AMQP] Application will shut down.');

      await instance.shutdown();
    } catch (err) {
      log.fatal({ ...params, err }, '[AMQP] Application shut down failed.');

      await processExit(1);
    }
  });

  return instance;
}
