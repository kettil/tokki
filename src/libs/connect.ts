import amqp from 'amqplib';

import Instance from './instance';
import { processExit } from './helper/process';

import { loggerType } from './types';

export const connect = async (log: loggerType, url: string, prefetch: number = 1): Promise<Instance> => {
  let connection: amqp.Connection;
  let channel: amqp.Channel;

  try {
    connection = await amqp.connect(url, {});
  } catch (err) {
    log.fatal({ err }, `[AMQP] Could not connect to ${url}.`);

    return (await processExit(1, 250)) as any;
  }
  log.info(`[AMQP] Connection has been established.`);

  try {
    channel = await connection.createChannel();
  } catch (err) {
    log.fatal({ err }, `[AMQP] Could not create a channel.`);

    await connection.close();

    return (await processExit(1, 1000)) as any;
  }
  log.info(`[AMQP] Channel has been created.`);

  await channel.prefetch(prefetch);

  return new Instance(log, connection, channel);
};

export default connect;
