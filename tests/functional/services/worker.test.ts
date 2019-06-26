const mockLogError = jest.fn();
const mockLogFatal = jest.fn();

import { amqpUrl, delay } from '../helper/config';

import Instance from '../../../src/libs/instance';
import Worker from '../../../src/libs/services/worker';

import connect from '../../../src/index';

import { consumerDataType } from '../../../src/libs/types';

const log: any = {
  child: () => log,
  debug: () => true,
  info: () => true,
  error: mockLogError,
  fatal: mockLogFatal,
};

jest.setTimeout(10000);

describe('Check the service worker', () => {
  let instance: Instance;
  let queueName: string;
  let mockPayload: jest.Mock;
  let consumer: (data: consumerDataType<{}>) => Promise<void>;
  let worker: Worker;

  /**
   *
   */
  beforeEach(async () => {
    instance = await connect({
      url: amqpUrl,
      log,
    });

    mockPayload = jest.fn();
    queueName = 'worker-queue';

    await instance.channel.deleteExchange(queueName);
    await instance.channel.deleteQueue(queueName);

    worker = await instance.worker(queueName);
  });

  /**
   *
   */
  afterEach(async (done) => {
    await instance.on('close', async () => {
      done();
    });

    await instance.close();
  });

  /**
   *
   */
  test('it should be processing of one worker when three jobs are created', async () => {
    expect.assertions(5);

    await worker.setConsumer(async (data) => {
      mockPayload(data.payload);

      await delay(200);

      await data.next();
    });

    await worker.send({ z: 23 });
    await worker.send({ z: 42 });
    await worker.send({ z: 7 });

    await delay(800);

    const { messageCount } = await instance.channel.checkQueue(queueName);

    expect(mockPayload.mock.calls.length).toBe(3);
    expect(mockPayload.mock.calls[0]).toEqual([{ z: 23 }]);
    expect(mockPayload.mock.calls[1]).toEqual([{ z: 42 }]);
    expect(mockPayload.mock.calls[2]).toEqual([{ z: 7 }]);
    expect(messageCount).toBe(0);
  });

  /**
   *
   */
  test('it should be processing of two workers when three jobs are created', async () => {
    expect.assertions(5);

    type payloadType = { z: string; d: number };

    const consumer1 = async (data: consumerDataType<payloadType>) => {
      mockPayload(data.payload);

      await delay(data.payload.d);

      await data.next();
    };

    const worker1 = await instance.createService<payloadType>(Worker, queueName, undefined, queueName + '-1');
    const worker2 = await instance.createService<payloadType>(Worker, queueName, undefined, queueName + '-2');

    await worker1.setConsumer(consumer1);
    await worker2.setConsumer(consumer1);

    await worker.send({ z: 'hi', d: 300 });
    await worker.send({ z: 'hello', d: 500 });
    await worker.send({ z: 'good morning', d: 200 });

    await delay(600);

    const { messageCount } = await instance.channel.checkQueue(queueName);

    expect(mockPayload.mock.calls.length).toBe(3);
    expect(mockPayload.mock.calls[0]).toEqual([{ z: 'hi', d: 300 }]);
    expect(mockPayload.mock.calls[1]).toEqual([{ z: 'hello', d: 500 }]);
    expect(mockPayload.mock.calls[2]).toEqual([{ z: 'good morning', d: 200 }]);
    expect(messageCount).toBe(0);
  });

  /**
   *
   */
  test('it should be the job is faulty (without covering) when a jobs are created', async () => {
    expect.assertions(3);

    consumer = async (data) => {
      mockPayload(data.payload);

      await delay(150);

      await data.discard();
    };

    await worker.setConsumer(consumer);

    await worker.send({ z: 'hi' });
    await delay(100);
    await worker.cancel();
    await delay(150);

    const { messageCount } = await instance.channel.checkQueue(queueName);

    expect(mockPayload.mock.calls.length).toBe(1);
    expect(mockPayload.mock.calls[0]).toEqual([{ z: 'hi' }]);
    expect(messageCount).toBe(0);
  });

  /**
   *
   */
  test('it should be the job is faulty (with covering) when a jobs are created', async () => {
    expect.assertions(3);

    consumer = async (data) => {
      mockPayload(data.payload);

      await delay(150);

      await data.defer();
    };

    await worker.setConsumer(consumer);

    await worker.send({ z: 'hi' });
    await delay(100);
    await worker.cancel();
    await delay(150);

    const { messageCount } = await instance.channel.checkQueue(queueName);

    expect(mockPayload.mock.calls.length).toBe(1);
    expect(mockPayload.mock.calls[0]).toEqual([{ z: 'hi' }]);
    expect(messageCount).toBe(1);
  });

  /**
   *
   */
  test('it should be the job is faulty (with covering) and successful at the second time when a jobs are created', async () => {
    expect.assertions(4);

    let firstRun = true;

    consumer = async (data) => {
      mockPayload(data.payload);

      await delay(50);

      if (firstRun) {
        await data.defer();
        firstRun = false;
      } else {
        await data.next();
      }
    };

    await worker.setConsumer(consumer);

    await worker.send({ z: 'hi' });

    await delay(250);

    const { messageCount } = await instance.channel.checkQueue(queueName);

    expect(mockPayload.mock.calls.length).toBe(2);
    expect(mockPayload.mock.calls[0]).toEqual([{ z: 'hi' }]);
    expect(mockPayload.mock.calls[1]).toEqual([{ z: 'hi' }]);
    expect(messageCount).toBe(0);
  });

  /**
   *
   */
  test('it should be the correct order for processing when seven prioritized jobs are created', async () => {
    expect.assertions(9);

    consumer = async (data) => {
      mockPayload(data.payload);

      await delay(75);

      await data.next();
    };

    await worker.setConsumer(consumer);

    await worker.send({ z: 'hi-1' });
    await worker.send({ z: 'hi-2' });
    await worker.send({ z: 'hi-3' });
    await worker.send({ z: 'hi-4' }, { priority: 5 });
    await worker.send({ z: 'hi-5' });
    await worker.send({ z: 'hi-6' });
    await worker.send({ z: 'hi-7' }, { priority: 10 });

    await delay(750);

    const { messageCount } = await instance.channel.checkQueue(queueName);

    expect(mockPayload.mock.calls.length).toBe(7);
    expect(mockPayload.mock.calls[0]).toEqual([{ z: 'hi-1' }]);
    expect(mockPayload.mock.calls[1]).toEqual([{ z: 'hi-7' }]);
    expect(mockPayload.mock.calls[2]).toEqual([{ z: 'hi-4' }]);
    expect(mockPayload.mock.calls[3]).toEqual([{ z: 'hi-2' }]);
    expect(mockPayload.mock.calls[4]).toEqual([{ z: 'hi-3' }]);
    expect(mockPayload.mock.calls[5]).toEqual([{ z: 'hi-5' }]);
    expect(mockPayload.mock.calls[6]).toEqual([{ z: 'hi-6' }]);
    expect(messageCount).toBe(0);
  });

  /**
   *
   */
  test('it should be an error in the processing when a jobs are created', async () => {
    expect.assertions(6);

    const errorMessage = 'functional-error-test';
    const queueName1 = 'worker-queue-1';
    const payload = { z: 'hi-to-other-worker' };

    await instance.channel.deleteExchange(queueName1);
    await instance.channel.deleteQueue(queueName1);

    const worker1 = await instance.worker(queueName1, worker);

    consumer = async (data) => {
      mockPayload(data.payload);

      throw new Error(errorMessage);
    };

    await worker1.setConsumer(consumer);

    worker1.send(payload);

    await delay(750);

    const { messageCount } = await instance.channel.checkQueue(queueName);
    const { messageCount: messageCount1 } = await instance.channel.checkQueue(queueName1);

    expect(mockPayload.mock.calls.length).toBe(1);
    expect(mockPayload.mock.calls[0]).toEqual([payload]);

    expect(mockLogError.mock.calls.length).toBe(1);
    expect(mockLogError.mock.calls[0]).toEqual([
      { lib: 'tokki', err: expect.any(Error), messageContent: payload },
      'Task has an error.',
    ]);

    expect(messageCount).toBe(1);
    expect(messageCount1).toBe(0);
  });
});
