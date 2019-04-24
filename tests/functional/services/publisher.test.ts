import { amqpUrl, delay } from '../config';

const mockLogError = jest.fn(console.log); // tslint:disable-line: no-console
const mockLogFatal = jest.fn(console.log); // tslint:disable-line: no-console

import Instance from '../../../src/libs/instance';
import Publisher from '../../../src/libs/services/publisher';

import connect from '../../../src/index';

import { consumerDataType } from '../../../src/libs/types';

jest.setTimeout(10000);

describe('Check the service worker', () => {
  let log: any;
  let instance: Instance;

  /**
   *
   */
  beforeEach(async () => {
    log = {
      child: () => log,
      debug: () => {}, // tslint:disable-line: no-empty
      info: () => {}, // tslint:disable-line: no-empty
      error: mockLogError,
      fatal: mockLogFatal,
    } as any;

    instance = await connect(
      log,
      amqpUrl,
    );

    await instance.channel.deleteExchange('publisher-queue');
    await instance.channel.deleteQueue('publisher-queue');
  });

  /**
   *
   */
  afterEach(async (done) => {
    await instance.on('close', async () => {
      done();
    });

    await instance.shutdown();
  });

  /**
   *
   */
  test('it should be call two publisher when message is sent', async (done) => {
    expect.assertions(3);

    const mockPayload = jest.fn();

    const publisher1 = await instance.createService<{ z: string }>(
      Publisher,
      'publisher-queue',
      undefined,
      'publisher-queue-1',
    );
    const publisher2 = await instance.createService<{ z: string }>(
      Publisher,
      'publisher-queue',
      undefined,
      'publisher-queue-2',
    );

    const publisher = await instance.publisher<{ z: string }>('publisher-queue');

    let i = 0;

    const consumer = async (data: consumerDataType<{ z: string }>) => {
      mockPayload(data.payload);

      await delay(500);

      await data.next();

      i += 1;
      if (i === 2) {
        expect(mockPayload.mock.calls.length).toBe(2);
        expect(mockPayload.mock.calls[0]).toEqual([{ z: 'hi' }]);
        expect(mockPayload.mock.calls[1]).toEqual([{ z: 'hi' }]);

        done();
      }
    };

    await publisher1.setConsumer(consumer);
    await publisher2.setConsumer(consumer);

    await delay(500);

    publisher.send({ z: 'hi' });
  });
});
