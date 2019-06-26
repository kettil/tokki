const mockDateNow = jest.spyOn(Date, 'now').mockImplementation();

const mockLogError = jest.fn();
const mockLogFatal = jest.fn();
const mockAmqpConnect = jest.fn();
const mockAmqpChannel = jest.fn();
const mockAmqpConnectOn = jest.fn();
const mockAmqpConnectClose = jest.fn();
const mockAmqpChannelOn = jest.fn();
const mockAmqpChannelClose = jest.fn();
const mockAmqpPrefetch = jest.fn();
const mockAmqpAssertExchange = jest.fn();
const mockAmqpAssertQueue = jest.fn();
const mockAmqpBindQueue = jest.fn();
const mockAmqpPublish = jest.fn();
const mockAmqpConsume = jest.fn();
const mockAmqpAck = jest.fn();
const mockAmqpNack = jest.fn();
const mockAmqpCancel = jest.fn();

jest.mock('amqplib', () => ({ connect: mockAmqpConnect }));

import Instance from '../../src/libs/instance';

import Publisher from '../../src/libs/services/publisher';
import Service from '../../src/libs/services/service';
import Worker from '../../src/libs/services/worker';

import connect from '../../src/index';

import { consumerDataType, SubType } from '../../src/libs/types';

const log: any = {
  child: () => log,
  debug: () => true,
  info: () => true,
  error: mockLogError,
  fatal: mockLogFatal,
};

/**
 *
 */
describe('Integration Testing', () => {
  let returnConnect: any;
  let returnChannel: any;
  let queueName: string;
  let queueTag: string;
  let payload: any;
  let message: any;

  /**
   *
   */
  beforeEach(() => {
    returnConnect = {
      createChannel: mockAmqpChannel,
      on: mockAmqpConnectOn,
      close: mockAmqpConnectClose,
    };
    returnChannel = {
      on: mockAmqpChannelOn,
      prefetch: mockAmqpPrefetch,
      assertExchange: mockAmqpAssertExchange,
      assertQueue: mockAmqpAssertQueue,
      bindQueue: mockAmqpBindQueue,
      publish: mockAmqpPublish,
      consume: mockAmqpConsume,
      ack: mockAmqpAck,
      nack: mockAmqpNack,
      cancel: mockAmqpCancel,
      close: mockAmqpChannelClose,
    };

    queueName = 'randome-queue-name';
    queueTag = 'randome-queue-tag';
    payload = { z: 42 };
    message = {
      content: Buffer.from(JSON.stringify(payload), 'utf8'),
      properties: {
        messageId: 'message-id',
      },
    };

    mockAmqpConnect.mockResolvedValue(returnConnect);
    mockAmqpChannel.mockResolvedValue(returnChannel);
    mockAmqpAssertQueue.mockResolvedValue({ queue: queueName });
    mockAmqpConsume.mockResolvedValue({ consumerTag: queueTag });
  });

  /**
   *
   */
  test('it should be create a instance when connect() is called', async () => {
    const instance = await connect(
      'rabbitmq-url',
      log,
      2,
    );

    expect(instance).toBeInstanceOf(Instance);

    expect(mockAmqpConnect).toHaveBeenCalledTimes(1);
    expect(mockAmqpConnect).toHaveBeenNthCalledWith(1, 'rabbitmq-url', {});

    expect(mockAmqpChannel).toHaveBeenCalledTimes(1);
    expect(mockAmqpChannel).toHaveBeenNthCalledWith(1);

    expect(mockAmqpPrefetch).toHaveBeenCalledTimes(1);
    expect(mockAmqpPrefetch).toHaveBeenNthCalledWith(1, 2);

    expect(mockLogError).toHaveBeenCalledTimes(0);
    expect(mockLogFatal).toHaveBeenCalledTimes(0);

    expect(mockAmqpConnectOn).toHaveBeenCalledTimes(2);
    expect(mockAmqpChannelOn).toHaveBeenCalledTimes(2);
  });

  const serviceValues: Array<[keyof SubType<Instance, (...args: any[]) => any>, any, string, number?]> = [
    ['worker', Worker, 'direct', 1],
    ['publisher', Publisher, 'fanout', undefined],
  ];

  /**
   *
   */
  test.each(serviceValues)('it should be create a service when %s() is called', async (type, ServiceType) => {
    const instance = await connect(
      'rabbitmq-url',
      log,
    );

    const service = await (instance[type] as any)('service-queue');

    expect(service).toBeInstanceOf(ServiceType);

    expect(mockLogError).toHaveBeenCalledTimes(0);
    expect(mockLogFatal).toHaveBeenCalledTimes(0);
  });

  /**
   *
   */
  test('it should be call amqp close() when shtudown is called', async () => {
    const mockConsumer = jest.fn();

    const instance = await connect(
      'rabbitmq-url',
      log,
    );

    mockAmqpConsume.mockResolvedValueOnce({ consumerTag: queueTag + 'p1' });
    mockAmqpConsume.mockResolvedValueOnce({ consumerTag: queueTag + 'p2' });
    mockAmqpConsume.mockResolvedValueOnce({ consumerTag: queueTag + 'w1' });
    mockAmqpConsume.mockResolvedValueOnce({ consumerTag: queueTag + 'w2' });

    const p1 = await instance.publisher('p1');
    const p2 = await instance.publisher('p2');
    const w1 = await instance.worker('w1');
    const w2 = await instance.worker('w2');
    const w3 = await instance.worker('w3');

    await p1.setConsumer(mockConsumer);
    await p2.setConsumer(mockConsumer);
    await w1.setConsumer(mockConsumer);
    await w2.setConsumer(mockConsumer);
    await w3.setConsumer(mockConsumer);

    await instance.close();

    expect(mockAmqpChannelClose).toHaveBeenCalledTimes(1);

    expect(mockAmqpConnectClose).toHaveBeenCalledTimes(1);

    expect(mockAmqpCancel).toHaveBeenCalledTimes(5);
    expect(mockAmqpCancel).toHaveBeenNthCalledWith(1, queueTag + 'p1');
    expect(mockAmqpCancel).toHaveBeenNthCalledWith(2, queueTag + 'p2');
    expect(mockAmqpCancel).toHaveBeenNthCalledWith(3, queueTag + 'w1');
    expect(mockAmqpCancel).toHaveBeenNthCalledWith(4, queueTag + 'w2');
    expect(mockAmqpCancel).toHaveBeenNthCalledWith(5, queueTag);
  });

  /**
   *
   */
  describe.each(serviceValues)('Check the %s service', (type, ServiceType, exchangeType, priority) => {
    let instance: Instance;
    let service: Service;

    /**
     *
     */
    beforeEach(async () => {
      instance = await connect(
        'rabbitmq-url',
        log,
      );

      service = await (instance[type] as any)(type + '-queue');
    });

    /**
     *
     */
    test('it should be call amqp publish() when job is created', async () => {
      mockDateNow.mockReturnValueOnce(1234567890123);

      await service.send({ ...payload });

      expect(mockAmqpAssertExchange).toHaveBeenCalledTimes(1);
      expect(mockAmqpAssertExchange).toHaveBeenNthCalledWith(1, type + '-queue', exchangeType, { durable: true });

      expect(mockAmqpPublish).toHaveBeenCalledTimes(1);
      expect(mockAmqpConsume).toHaveBeenCalledTimes(0);
      expect(mockAmqpPublish.mock.calls[0]).toEqual([
        type + '-queue',
        '',
        Buffer.from(JSON.stringify(payload), 'utf8'),
        { persistent: true, priority, timestamp: 1234567890123 },
      ]);

      expect(mockLogError).toHaveBeenCalledTimes(0);
      expect(mockLogFatal).toHaveBeenCalledTimes(0);
    });

    /**
     *
     */
    test('it should be call amqp consume() when consumer is added', async () => {
      const queueNameInternal = type === 'publisher' ? 'randome-queue-name' : type + '-queue';
      const mockConsumer = jest.fn();

      await service.setConsumer(mockConsumer);

      expect(mockAmqpPublish).toHaveBeenCalledTimes(0);
      expect(mockAmqpConsume).toHaveBeenCalledTimes(1);
      expect(mockAmqpConsume).toHaveBeenNthCalledWith(1, queueNameInternal, expect.any(Function), { noAck: false });
      expect(mockConsumer).toHaveBeenCalledTimes(0);

      expect(mockLogError).toHaveBeenCalledTimes(0);
      expect(mockLogFatal).toHaveBeenCalledTimes(0);
    });

    /**
     *
     */
    test('it should be complete the job successfully when a new job is created', async () => {
      expect.assertions(11);

      const mockConsumer = jest.fn(async (data: consumerDataType<any>) => {
        expect(data.log).toBe(log);
        expect(data.payload).toEqual(payload);

        await data.next();
      });

      await service.setConsumer(mockConsumer);

      expect(mockAmqpConsume).toHaveBeenCalledTimes(1);
      expect(mockAmqpConsume.mock.calls[0][1]).toEqual(expect.any(Function));

      const consumer = mockAmqpConsume.mock.calls[0][1];

      await consumer(message);

      expect(mockAmqpPublish).toHaveBeenCalledTimes(0);
      expect(mockConsumer).toHaveBeenCalledTimes(1);
      expect(mockAmqpAck).toHaveBeenCalledTimes(1);
      expect(mockAmqpNack).toHaveBeenCalledTimes(0);
      expect(mockLogError).toHaveBeenCalledTimes(0);
      expect(mockLogFatal).toHaveBeenCalledTimes(0);

      expect(mockAmqpAck).toHaveBeenNthCalledWith(1, message);
    });

    /**
     *
     */
    test('it should be throw an error when a new job is created', async () => {
      expect.assertions(8);

      const mockConsumer = jest.fn(async (data: consumerDataType<any>) => {
        throw new Error('Consumer Error');
      });

      await service.setConsumer(mockConsumer);

      expect(mockAmqpConsume).toHaveBeenCalledTimes(1);
      expect(mockAmqpConsume.mock.calls[0][1]).toEqual(expect.any(Function));

      const consumer = mockAmqpConsume.mock.calls[0][1];

      await consumer(message);

      expect(mockAmqpPublish).toHaveBeenCalledTimes(0);
      expect(mockConsumer).toHaveBeenCalledTimes(1);
      expect(mockAmqpAck).toHaveBeenCalledTimes(0);
      expect(mockAmqpNack).toHaveBeenCalledTimes(1);
      expect(mockLogError).toHaveBeenCalledTimes(1);
      expect(mockLogFatal).toHaveBeenCalledTimes(0);
    });

    /**
     *
     */
    test('it should be throw an error and forwards this when a new job is created', async () => {
      mockDateNow.mockReturnValueOnce(1987654321098);

      expect.assertions(9);

      const service2 = await (instance[type] as any)(type + '-queue-2', service);
      const error = new Error('Consumer Error with forwading');

      const mockConsumer = jest.fn(async (data: consumerDataType<any>) => {
        throw error;
      });

      await service2.setConsumer(mockConsumer);

      expect(mockAmqpConsume).toHaveBeenCalledTimes(1);
      expect(mockAmqpConsume.mock.calls[0][1]).toEqual(expect.any(Function));

      const consumer = mockAmqpConsume.mock.calls[0][1];

      await consumer(message);

      expect(mockAmqpPublish).toHaveBeenCalledTimes(1);
      expect(mockConsumer).toHaveBeenCalledTimes(1);
      expect(mockAmqpAck).toHaveBeenCalledTimes(0);
      expect(mockAmqpNack).toHaveBeenCalledTimes(1);
      expect(mockLogError).toHaveBeenCalledTimes(1);
      expect(mockLogFatal).toHaveBeenCalledTimes(0);

      expect(mockAmqpPublish.mock.calls[0]).toEqual([
        type + '-queue',
        '',
        Buffer.from(
          JSON.stringify({
            queue: type + '-queue-2',
            payload,
            name: error.name,
            message: error.message,
            stack: error.stack ? error.stack.split('\n') : [],
          }),
        ),
        { persistent: true, priority, timestamp: 1987654321098 },
      ]);
    });
  });
});
