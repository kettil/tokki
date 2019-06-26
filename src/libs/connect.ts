import amqp from 'amqplib';

import { logDummy } from './helper';
import Instance from './instance';

import { InterfaceLogger } from './types';

/**
 *
 * @param url
 * @param log
 * @param prefetch
 */
export const connect = async (
  url: string,
  log: InterfaceLogger = logDummy,
  prefetch: number = 1,
): Promise<Instance> => {
  let connection: amqp.Connection;
  let channel: amqp.Channel;

  try {
    connection = await amqp.connect(url, {});
  } catch (err) {
    log.fatal({ lib: 'tokki', err }, `Could not connect to "${url.replace(/:([^@]+)@/, ':[protected]@')}".`);

    throw err;
  }
  log.info({ lib: 'tokki' }, `Connection has been established.`);

  try {
    channel = await connection.createChannel();
  } catch (err) {
    log.fatal({ lib: 'tokki', err }, `Could not create a channel.`);

    await connection.close();

    throw err;
  }
  log.info({ lib: 'tokki' }, `Channel has been created.`);

  await channel.prefetch(prefetch);

  const instance = new Instance(log, connection, channel);

  await instance.initEvents();

  return instance;
};

export default connect;
