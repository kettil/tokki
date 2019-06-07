import amqp from 'amqplib';

import Instance from './instance';

import { InterfaceLogger } from './types';

export const connect = async (log: InterfaceLogger, url: string, prefetch: number = 1): Promise<Instance> => {
  let connection: amqp.Connection;
  let channel: amqp.Channel;

  try {
    connection = await amqp.connect(url, {});
  } catch (err) {
    log.fatal({ err }, `[AMQP] Could not connect to "${url.replace(/:([^@]+)@/, ':[protected]@')}".`);

    throw err;
  }
  log.info(`[AMQP] Connection has been established.`);

  try {
    channel = await connection.createChannel();
  } catch (err) {
    log.fatal({ err }, `[AMQP] Could not create a channel.`);

    await connection.close();

    throw err;
  }
  log.info(`[AMQP] Channel has been created.`);

  await channel.prefetch(prefetch);

  const instance = new Instance(log, connection, channel);

  await instance.initEvents();

  return instance;
};

export default connect;
