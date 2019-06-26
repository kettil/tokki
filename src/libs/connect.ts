import amqp from 'amqplib';

import { logDummy } from './helper';
import Instance from './instance';

import { connectArgsType } from './types';

/**
 *
 * @param url
 * @param log
 * @param prefetch
 */
export const connect = async ({
  url,
  log = logDummy,
  prefetch = 1,
  options = {},
}: connectArgsType): Promise<Instance> => {
  let connection: amqp.Connection;
  let channel: amqp.Channel;

  try {
    connection = await amqp.connect(url, options);
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
