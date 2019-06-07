const mockLogError = jest.fn();
const mockLogFatal = jest.fn();

import { amqpUrl, delay } from './helper/config';

import Instance from '../../src/libs/instance';

import connect from '../../src/index';

const log: any = {
  child: () => log,
  debug: () => true,
  info: () => true,
  error: mockLogError,
  fatal: mockLogFatal,
};

jest.setTimeout(10000);

/**
 *
 */
describe('Functional Testing', () => {
  /**
   *
   */
  test('it should be establishes and closes a connection when connect() and close() is called', async (done) => {
    expect.assertions(3);

    const instance = await connect(
      log,
      amqpUrl,
    );

    expect(instance).toBeInstanceOf(Instance);

    await instance.on('close', async () => {
      expect(mockLogError.mock.calls.length).toBe(0);
      expect(mockLogFatal.mock.calls.length).toBe(0);

      done();
    });

    await delay(250);

    await instance.close();
  });

  /**
   *
   */
  test('it should be closes a connection when close() is called and all jobs finished', async (done) => {
    expect.assertions(9);

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

      done();
    });

    await delay(1150);

    await instance.close();
  });

  /**
   *
   */
  test('it should be throw a error and close the connection when status of a non-existent queue is checked.', async (done) => {
    expect.assertions(4);

    const instance = await connect(
      log,
      amqpUrl,
    );

    await instance.channel.deleteExchange('notExistQueue');
    await instance.channel.deleteQueue('notExistQueue');

    await instance.on('close', async () => {
      expect(mockLogError.mock.calls.length).toBe(0);
      expect(mockLogFatal.mock.calls.length).toBe(1);

      done();
    });

    try {
      await instance.channel.checkQueue('notExistQueue');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe(
        `Operation failed: QueueDeclare; 404 (NOT-FOUND) with message "NOT_FOUND - no queue 'notExistQueue' in vhost '/'"`,
      );
    }
  });
});
