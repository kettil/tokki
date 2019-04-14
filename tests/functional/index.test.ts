const amqpHost = process.env.AMQP_HOST || 'localhost';
const amqpPort = process.env.AMQP_PORT || 5672;
const amqpUser = process.env.AMQP_USER || 'guest';
const amqpPassword = process.env.AMQP_PASSWORD || 'guest';
const amqpUrl = `amqp://${amqpUser}:${amqpPassword}@${amqpHost}:${amqpPort}`;

const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation();

const mockLogError = jest.fn(console.log);
const mockLogFatal = jest.fn(console.log);

import Instance from '../../src/libs/instance';
import Publisher from '../../src/libs/service/publisher';
import Worker from '../../src/libs/service/worker';

import connect from '../../src/index';

import { consumerDataType } from '../../src/libs/types';

jest.setTimeout(10000);

const delay = (delay: number) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, delay);
  });
};

describe('Functional Testing', () => {
  let log: any;

  /**
   *
   */
  beforeEach(() => {
    log = {
      child: () => log,
      debug: () => {}, // tslint:disable-line: no-empty
      info: () => {}, // tslint:disable-line: no-empty
      //debug: console.log,
      //info: console.log,
      error: mockLogError,
      fatal: mockLogFatal,
    } as any;
  });

  /**
   *
   */
  test('it should be establishes and closes a connection when connect() and shutdown() is called', async (done) => {
    expect.assertions(4);

    const instance = await connect(
      log,
      amqpUrl,
    );

    expect(instance).toBeInstanceOf(Instance);

    await instance.on('close', async () => {
      expect(mockLogError.mock.calls.length).toBe(0);
      expect(mockLogFatal.mock.calls.length).toBe(0);
      expect(mockProcessExit.mock.calls.length).toBe(0);

      done();
    });

    await delay(250);

    await instance.shutdown();
  });

  /**
   *
   */
  test('it should be closes a connection when shutdown() is called and all jobs finished', async (done) => {
    expect.assertions(10);

    const instance = await connect(
      log,
      amqpUrl,
    );

    await instance.channel.deleteExchange('sd-q1');
    await instance.channel.deleteExchange('sd-q2');
    await instance.channel.deleteQueue('sd-q1');
    await instance.channel.deleteQueue('sd-q2');

    const mockAfter1 = jest.fn();
    const mockAfter2 = jest.fn();
    const mockConsumer1 = jest.fn(async (d) => {
      await delay(1500);

      await mockAfter1(d.payload.z);
      await d.next();
    });

    const mockConsumer2 = jest.fn(async (d) => {
      await delay(1000);

      await mockAfter2(d.payload.z);
      await d.next();
    });

    const worker1 = await instance.worker<{ z: number }>('sd-q1');
    const worker2 = await instance.worker<{ z: number }>('sd-q2');

    await worker1.setConsumer(mockConsumer1);
    await worker2.setConsumer(mockConsumer2);

    await worker1.send({ z: 13 });
    await worker2.send({ z: 7 });
    await worker2.send({ z: 23 });
    // The following jobs is not executed.
    await worker1.send({ z: 42 });
    await worker2.send({ z: 3 });
    await worker1.send({ z: 99 });

    await instance.on('close', async () => {
      expect(mockConsumer1.mock.calls.length).toBe(1);
      expect(mockConsumer2.mock.calls.length).toBe(2);

      expect(mockAfter1.mock.calls.length).toBe(1);
      expect(mockAfter2.mock.calls.length).toBe(2);

      expect(mockAfter1.mock.calls[0]).toEqual([13]);
      expect(mockAfter2.mock.calls[0]).toEqual([7]);
      expect(mockAfter2.mock.calls[1]).toEqual([23]);

      expect(mockLogError.mock.calls.length).toBe(0);
      expect(mockLogFatal.mock.calls.length).toBe(0);
      expect(mockProcessExit.mock.calls.length).toBe(0);

      done();
    });

    await delay(1150);

    await instance.shutdown();
  });

  /**
   *
   */
  describe('Service handling', () => {
    let instance: Instance;

    /**
     *
     */
    beforeEach(async () => {
      instance = await connect(
        log,
        amqpUrl,
      );
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
    test('it should be error-free processing of one worker when three jobs are created', async (done) => {
      await instance.channel.deleteExchange('worker-queue');
      await instance.channel.deleteQueue('worker-queue');

      expect.assertions(4);

      const mockPayload = jest.fn();

      const worker = await instance.worker<{ z: number; last?: boolean }>('worker-queue');

      await worker.setConsumer(async (data) => {
        mockPayload(data.payload);

        await delay(200);

        await data.next();

        if (data.payload.last) {
          expect(mockPayload.mock.calls.length).toBe(3);
          expect(mockPayload.mock.calls[0]).toEqual([{ z: 23 }]);
          expect(mockPayload.mock.calls[1]).toEqual([{ z: 42, last: false }]);
          expect(mockPayload.mock.calls[2]).toEqual([{ z: 7, last: true }]);

          done();
        }
      });

      worker.send({ z: 23 });
      worker.send({ z: 42, last: false });
      worker.send({ z: 7, last: true });
    });

    /**
     *
     */
    test('it should be error-free processing of two workers when three jobs are created', async (done) => {
      await instance.channel.deleteExchange('worker-queue');
      await instance.channel.deleteQueue('worker-queue');

      expect.assertions(4);

      const mockPayload = jest.fn();

      const worker = await instance.worker<{ z: string; d: number; l?: boolean }>('worker-queue');
      const worker1 = await instance.createService<{ z: string; d: number; l?: boolean }>(
        Worker,
        'worker-queue',
        undefined,
        'worker-queue-1',
      );
      const worker2 = await instance.createService<{ z: string; d: number; l?: boolean }>(
        Worker,
        'worker-queue',
        undefined,
        'worker-queue-2',
      );

      worker.send({ z: 'hi', d: 1500 });
      worker.send({ z: 'hello', d: 3000, l: false });
      worker.send({ z: 'good morning', d: 2500, l: true });

      const consumer = async (data: consumerDataType<{ z: string; d: number; l?: boolean }>) => {
        mockPayload(data.payload);

        await delay(data.payload.d);

        await data.next();

        if (data.payload.l) {
          expect(mockPayload.mock.calls.length).toBe(3);
          expect(mockPayload.mock.calls[0]).toEqual([{ z: 'hi', d: 1500 }]);
          expect(mockPayload.mock.calls[1]).toEqual([{ z: 'hello', d: 3000, l: false }]);
          expect(mockPayload.mock.calls[2]).toEqual([{ z: 'good morning', d: 2500, l: true }]);

          done();
        }
      };

      await worker1.setConsumer(consumer);
      await worker2.setConsumer(consumer);
    });

    /**
     *
     */
    test('it should be call two publisher when message is sent', async (done) => {
      await instance.channel.deleteExchange('publisher-queue');
      await instance.channel.deleteQueue('publisher-queue');

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
});
