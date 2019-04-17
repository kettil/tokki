import amqp from 'amqplib';

import { processExit } from './helper/process';
import Instance from './instance';

import { loggerType } from './types';

export const connect = async (log: loggerType, url: string, prefetch: number = 1): Promise<Instance> => {
  let connection: amqp.Connection;
  let channel: amqp.Channel;

  try {
    connection = await amqp.connect(url, {});
  } catch (err) {
    log.fatal({ err }, `[AMQP] Could not connect to ${url}.`);

    await processExit(1, 250);

    return {} as any;
  }
  log.info(`[AMQP] Connection has been established.`);

  try {
    channel = await connection.createChannel();
  } catch (err) {
    log.fatal({ err }, `[AMQP] Could not create a channel.`);

    await connection.close();

    await processExit(1, 250);

    return {} as any;
  }
  log.info(`[AMQP] Channel has been created.`);

  await channel.prefetch(prefetch);

  const instance = new Instance(log, connection, channel);

  await instance.initEvents();

  return instance;
};

export default connect;
