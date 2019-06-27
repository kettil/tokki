jest.mock('../helper');

const mockDateNow = jest.spyOn(Date, 'now').mockImplementation();
const mockProcessEmit = jest.spyOn(process, 'emit').mockImplementation();

const mockChannelPublish = jest.fn();
const mockChannelConsume = jest.fn().mockResolvedValue({ consumerTag: 'abcdef' });
const mockChannelCancel = jest.fn();
const mockChannelNack = jest.fn();
const mockChannelAck = jest.fn();
const mockServicesGet = jest.fn();
const mockErrorServiceSend = jest.fn();
const mockLogInfo = jest.fn();

import Joi from '@hapi/joi';

import { delay } from '../helper';

import Service from './service';

/**
 *
 */
describe('Check the class Service', () => {
  let service: Service;
  let errorService: any;
  let services: { [k: string]: any };
  let instance: any;
  let log: any;

  const name = 'test-queue';

  /**
   *
   */
  beforeEach(() => {
    const channel = {
      publish: mockChannelPublish,
      consume: mockChannelConsume,
      cancel: mockChannelCancel,
      nack: mockChannelNack,
      ack: mockChannelAck,
    };

    log = {
      child: () => log,
      debug: () => true,
      info: mockLogInfo,
      error: () => true,
      fatal: () => true,
    } as any;

    errorService = {
      send: mockErrorServiceSend,
    };

    services = {
      get: mockServicesGet,
    };

    instance = {
      channel,
      services,
    };

    // create an instance from a abstract class
    service = new Service(log, instance, name, errorService);
  });

  /**
   *
   */
  test('initialize the class', () => {
    expect(service).toBeInstanceOf(Service);

    // Checked the protected class variables
    expect((service as any).instance).toBe(instance);
    expect((service as any).countTasks).toBe(0);
    expect((service as any).isInitialized).toEqual({ global: false, consumer: false, sender: false });
    expect((service as any).consumerTag).toEqual(undefined);

    expect((service as any).log).toBe(log);
    expect((service as any).name).toBe(name);
    expect((service as any).error).toBe(errorService);
  });

  /**
   *
   */
  describe('Process flow from error handling', () => {
    /**
     *
     */
    const testErrorHandlingValue: Array<[string, any, string, string]> = [
      ['undefined error', undefined, 'Error', 'unknown error'],
      ['error string', 'test-error-string', 'Error', 'test-error-string'],
      ['error object', new Error('test-error'), 'Error', 'test-error'],
    ];

    /**
     *
     */
    test.each(testErrorHandlingValue)(
      'it should be handled in errorHandling() an %s',
      async (t, err, errName, errMsg) => {
        expect.assertions(7);

        return new Promise(async (resolve, reject) => {
          const payload = { a: 'z', b: 42, t: true };
          const message: any = { content: Buffer.from(JSON.stringify(payload)) };

          service.on('error-task', async (err2, data) => {
            try {
              expect(err2).toBeInstanceOf(Error);
              expect(err2.message).toBe(errMsg);

              expect(data).toEqual(payload);
            } catch (e) {
              reject(e);
            }
          });

          await (service as any).errorHandling(log, message, err);

          expect(mockChannelNack.mock.calls.length).toBe(1);
          expect(mockChannelNack.mock.calls[0]).toEqual([message, false, false]);

          expect(mockErrorServiceSend).toHaveBeenCalledTimes(1);
          expect(mockErrorServiceSend).toHaveBeenNthCalledWith(1, {
            payload,
            queue: name,
            name: errName,
            message: errMsg,
            stack: expect.any(String),
          });

          resolve();
        });
      },
    );

    /**
     *
     */
    test('it should be handled in errorHandling() an error object without stack', async (done) => {
      const err = new Error('test-error');
      const payload = { a: 'z', b: 42, t: true };
      const message: any = { content: Buffer.from(JSON.stringify(payload)) };

      err.stack = undefined;

      service.on('error-task', async (err2, data) => {
        try {
          expect(err2).toBeInstanceOf(Error);
          expect(err2.message).toBe('test-error');

          expect(data).toEqual(payload);
        } catch (e) {
          done(e);
        }
      });

      await (service as any).errorHandling(log, message, err);

      expect(mockChannelNack.mock.calls.length).toBe(1);
      expect(mockChannelNack.mock.calls[0]).toEqual([message, false, false]);
      expect(mockErrorServiceSend.mock.calls.length).toBe(1);
      expect(mockErrorServiceSend.mock.calls[0]).toEqual([
        {
          payload,
          queue: name,
          name: err.name,
          message: 'test-error',
          stack: '',
        },
      ]);

      done();
    });

    /**
     *
     */
    test('it should be handled in errorHandling() an error object and throw a sub error', async (done) => {
      expect.assertions(5);

      const err1 = 'test-error';
      const err2 = 'test-channel-error';
      const payload = { a: 'z', b: 42, t: true };
      const message: any = { content: Buffer.from(JSON.stringify(payload)) };

      mockChannelNack.mockRejectedValueOnce(new Error(err2));

      service.on('error', async (err) => {
        try {
          expect(err).toBeInstanceOf(Error);
          expect(err.message).toBe('test-channel-error');
        } catch (e) {
          done(e);
        }
      });

      await (service as any).errorHandling(log, message, new Error(err1));

      expect(mockChannelNack.mock.calls.length).toBe(1);
      expect(mockChannelNack.mock.calls[0]).toEqual([message, false, false]);
      expect(mockErrorServiceSend.mock.calls.length).toBe(0);

      done();
    });

    /**
     *
     */
    test('it should be handled in errorHandling() an error object and throw a error in the error event', async () => {
      expect.assertions(5);

      const err1 = 'test-error';
      const err2 = 'test-channel-error';
      const payload = { a: 'z', b: 42, t: true };
      const message: any = { content: Buffer.from(JSON.stringify(payload)) };

      mockChannelNack.mockRejectedValueOnce(new Error(err2));

      service.on('error', async (err) => {
        throw new Error('event-error');
      });

      await (service as any).errorHandling(log, message, new Error(err1));

      expect(mockChannelNack.mock.calls.length).toBe(1);
      expect(mockChannelNack.mock.calls[0]).toEqual([message, false, false]);
      expect(mockErrorServiceSend.mock.calls.length).toBe(0);

      expect(mockProcessEmit).toHaveBeenCalledTimes(1);
      expect(mockProcessEmit).toHaveBeenNthCalledWith(1, 'uncaughtException', new Error('event-error'));
    });

    /**
     *
     */
    test('it should be handled the error when errorHandling() is called with invalid JSON', async (done) => {
      expect.assertions(7);

      const err1 = 'test-error';
      const message: any = { content: Buffer.from('{a:"z",b:42,t:true}') };

      service.on('error-task', async (err, data) => {
        try {
          expect(err).toBeInstanceOf(Error);
          expect(err.message).toBe('test-error');

          expect(data).toEqual('{a:"z",b:42,t:true}');
        } catch (e) {
          done(e);
        }
      });

      await (service as any).errorHandling(log, message, new Error(err1));

      expect(mockChannelNack.mock.calls.length).toBe(1);
      expect(mockChannelNack.mock.calls[0]).toEqual([message, false, false]);
      expect(mockErrorServiceSend.mock.calls.length).toBe(1);
      expect(mockErrorServiceSend.mock.calls[0]).toEqual([
        {
          payload: '{a:"z",b:42,t:true}',
          queue: name,
          message: 'test-error',
          name: 'Error',
          stack: expect.any(String),
        },
      ]);

      done();
    });

    /**
     *
     */
    test('it should be handled the error without send to the other queue when errorHandling() is called', async (done) => {
      expect.assertions(6);

      // create an instance from a abstract class
      service = new Service(log, instance, name);

      const err = new Error('test-error');
      const payload = { a: 'z', b: 42, t: true };
      const message: any = { content: Buffer.from(JSON.stringify(payload)) };

      service.on('error-task', async (err2, data) => {
        try {
          expect(err2).toBeInstanceOf(Error);
          expect(err2.message).toBe('test-error');

          expect(data).toEqual(payload);
        } catch (e) {
          done(e);
        }
      });

      await (service as any).errorHandling(log, message, err);

      expect(mockChannelNack.mock.calls.length).toBe(1);
      expect(mockChannelNack.mock.calls[0]).toEqual([message, false, false]);
      expect(mockErrorServiceSend.mock.calls.length).toBe(0);

      done();
    });
  });

  /**
   *
   */
  describe('Process flow from task counter', () => {
    /**
     *
     */
    test('it should be counter is equal 5 when taskCreated() is called 5 times', () => {
      expect((service as any).countTasks).toBe(0);

      (service as any).taskCreated();
      (service as any).taskCreated();
      (service as any).taskCreated();
      (service as any).taskCreated();
      (service as any).taskCreated();

      expect((service as any).countTasks).toBe(5);
    });

    /**
     *
     */
    test('it should be counter is equal 2 when taskCompleted() is called 3 times and counter started with 5', () => {
      expect((service as any).countTasks).toBe(0);

      (service as any).countTasks = 4;

      (service as any).taskCompleted();
      (service as any).taskCompleted();
      (service as any).taskCompleted();
      (service as any).taskCompleted();

      expect((service as any).countTasks).toBe(0);
    });

    /**
     *
     */
    test('it should be counter is equal 0 when taskCompleted() is called 2 times and counter started with 1', () => {
      expect((service as any).countTasks).toBe(0);

      (service as any).countTasks = 1;

      (service as any).taskCompleted();
      (service as any).taskCompleted();

      expect((service as any).countTasks).toBe(0);
    });
  });

  /**
   *
   */
  describe('Process flow from sender', () => {
    /**
     *
     */
    test('it should be publish when function send() is called', async () => {
      mockDateNow.mockReturnValueOnce(1234567890123);

      const mockGlobal = jest.fn();
      const mockSender = jest.fn();
      const payload = { a: 'z', n: 23 };

      service.initializeGlobal = mockGlobal;
      service.initializeSender = mockSender;

      await service.send(payload);

      expect(mockGlobal.mock.calls.length).toBe(1);
      expect(mockSender.mock.calls.length).toBe(1);
      expect(mockChannelPublish.mock.calls.length).toBe(1);
      expect(mockChannelPublish.mock.calls[0]).toEqual([
        'test-queue',
        '',
        Buffer.from(JSON.stringify(payload), 'utf8'),
        { persistent: true, priority: undefined, timestamp: 1234567890123 },
      ]);
    });

    /**
     *
     */
    test('it should be publish when function send() is called twice', async () => {
      mockDateNow.mockReturnValueOnce(1234567890123);
      mockDateNow.mockReturnValueOnce(1987654321098);

      const mockGlobal = jest.fn();
      const mockSender = jest.fn();

      service.initializeGlobal = mockGlobal;
      service.initializeSender = mockSender;

      await service.send({ a: 1 });
      await service.send({ a: 2 });

      expect(mockGlobal.mock.calls.length).toBe(1);
      expect(mockSender.mock.calls.length).toBe(1);
      expect(mockChannelPublish.mock.calls.length).toBe(2);
      expect(mockChannelPublish.mock.calls[0]).toEqual([
        'test-queue',
        '',
        Buffer.from(JSON.stringify({ a: 1 }), 'utf8'),
        { persistent: true, priority: undefined, timestamp: 1234567890123 },
      ]);
      expect(mockChannelPublish.mock.calls[1]).toEqual([
        'test-queue',
        '',
        Buffer.from(JSON.stringify({ a: 2 }), 'utf8'),
        { persistent: true, priority: undefined, timestamp: 1987654321098 },
      ]);
    });
  });

  /**
   *
   */
  describe('Process flow from consumer', () => {
    /**
     *
     */
    test('it should be consumer callback is registered when function setConsumer() is called', async () => {
      const mockGlobal = jest.fn();
      const mockConsumer = jest.fn();
      const mockWorker = jest.fn();

      service.initializeGlobal = mockGlobal;
      service.initializeConsumer = mockConsumer;

      await service.setConsumer(mockWorker);

      expect((service as any).consumerTag).toBe('abcdef');
      expect(mockGlobal.mock.calls.length).toBe(1);
      expect(mockConsumer.mock.calls.length).toBe(1);
      expect(mockChannelConsume.mock.calls.length).toBe(1);
      expect(mockChannelConsume.mock.calls[0]).toEqual(['test-queue', expect.any(Function), { noAck: false }]);
      expect(mockChannelCancel.mock.calls.length).toBe(0);
    });

    /**
     *
     */
    test('it should be only last consumer callback is registered when function setConsumer() is called twice', async () => {
      const mockGlobal = jest.fn();
      const mockConsumer = jest.fn();
      const mockWorker1 = jest.fn();
      const mockWorker2 = jest.fn();

      mockChannelConsume.mockResolvedValueOnce({ consumerTag: '123456' });

      service.initializeGlobal = mockGlobal;
      service.initializeConsumer = mockConsumer;

      await service.setConsumer(mockWorker1);

      expect((service as any).consumerTag).toBe('123456');

      await service.setConsumer(mockWorker2);

      expect((service as any).consumerTag).toBe('abcdef');

      expect(mockGlobal.mock.calls.length).toBe(1);
      expect(mockConsumer.mock.calls.length).toBe(1);
      expect(mockChannelConsume.mock.calls.length).toBe(2);
      expect(mockChannelConsume.mock.calls[0]).toEqual(['test-queue', expect.any(Function), { noAck: false }]);
      expect(mockChannelConsume.mock.calls[1]).toEqual(['test-queue', expect.any(Function), { noAck: false }]);
      expect(mockChannelCancel.mock.calls.length).toBe(1);
    });

    /**
     *
     */
    test('it should be not call consumer callback when the internal consumer is called with NULL', async () => {
      const mockWorker = jest.fn();

      await service.setConsumer(mockWorker);

      expect(mockChannelConsume.mock.calls.length).toBe(1);
      expect(mockChannelConsume.mock.calls[0]).toEqual(['test-queue', expect.any(Function), { noAck: false }]);

      const consumer: any = mockChannelConsume.mock.calls[0][1 as any];

      await consumer(null);

      expect(mockLogInfo.mock.calls.length).toBe(2);
      expect(mockLogInfo.mock.calls[1]).toEqual([{ lib: 'tokki' }, 'New task without consume message']);
    });

    /**
     *
     */
    test('it should be internal consumer catched an error when consumer callback throw an error', async (done) => {
      expect.assertions(7);

      const errorMessage = 'error-message';
      const mockWorker = jest.fn(() => Promise.reject(new Error(errorMessage)));
      const payload = { a: 'z', b: 42, t: true };
      const message = { content: Buffer.from(JSON.stringify(payload)), properties: { messageId: '13579' } };

      service.on('error-task', async (err, data) => {
        try {
          expect(err).toBeInstanceOf(Error);
          expect(err.message).toBe('error-message');

          expect(data).toEqual(payload);
        } catch (e) {
          done(e);
        }
      });

      await service.setConsumer(mockWorker);

      expect(mockChannelConsume.mock.calls.length).toBe(1);
      expect(mockChannelConsume.mock.calls[0]).toEqual(['test-queue', expect.any(Function), { noAck: false }]);

      const consumer: any = mockChannelConsume.mock.calls[0][1 as any];

      await consumer(message);

      expect(mockChannelNack.mock.calls.length).toBe(1);
      expect(mockChannelNack.mock.calls[0]).toEqual([message, false, false]);

      done();
    });

    /**
     *
     */
    test('it should be payload validate when a joi schema is delivered', async () => {
      const mockWorker = jest.fn(async (d) => {
        d.next();
      });
      const payload = { a: 'z', b: 42, t: true };
      const message = { content: Buffer.from(JSON.stringify(payload)), properties: { messageId: '13579' } };

      const schema = Joi.object().keys({
        a: Joi.string(),
        b: Joi.number(),
      });

      service = new Service(log, instance, name, errorService, schema);

      await service.setConsumer(mockWorker);

      expect(mockChannelConsume.mock.calls.length).toBe(1);
      expect(mockChannelConsume.mock.calls[0]).toEqual(['test-queue', expect.any(Function), { noAck: false }]);

      const consumer: any = mockChannelConsume.mock.calls[0][1 as any];

      await consumer(message);

      expect(mockWorker.mock.calls.length).toBe(1);
      expect(mockWorker.mock.calls[0][0].payload).toEqual({ a: 'z', b: 42 });
    });

    /**
     *
     */
    test('it should be throw an error when a joi schema is delivered and payload is invalidate', async (done) => {
      expect.assertions(8);

      const mockWorker = jest.fn();
      const payload = { a: 'z', b: 42, t: true };
      const message = { content: Buffer.from(JSON.stringify(payload)), properties: { messageId: '13579' } };

      const schema = Joi.object().keys({
        a: Joi.number(),
        b: Joi.number(),
      });

      service = new Service(log, instance, name, errorService, schema);

      service.on('error-task', async (err, data) => {
        try {
          expect(err).toBeInstanceOf(Error);
          expect(err.message).toBe('child "a" fails because ["a" must be a number]');

          expect(data).toEqual(payload);
        } catch (e) {
          done(e);
        }
      });

      await service.setConsumer(mockWorker);

      expect(mockChannelConsume.mock.calls.length).toBe(1);
      expect(mockChannelConsume.mock.calls[0]).toEqual(['test-queue', expect.any(Function), { noAck: false }]);

      const consumer: any = mockChannelConsume.mock.calls[0][1 as any];

      await consumer(message);

      expect(mockWorker.mock.calls.length).toBe(0);

      expect(mockChannelNack.mock.calls.length).toBe(1);
      expect(mockChannelNack.mock.calls[0]).toEqual([message, false, false]);

      done();
    });

    /**
     *
     */
    describe('Check the data sub function', () => {
      let mockWorker: jest.Mock;
      let payload: any;
      let message: any;
      let consumer: any;

      /**
       *
       */
      beforeEach(async () => {
        payload = { a: 'z', b: 42, t: true };
        message = { content: Buffer.from(JSON.stringify(payload)), properties: { messageId: '13579' } };
        mockWorker = jest.fn();

        await service.setConsumer(mockWorker);

        consumer = mockChannelConsume.mock.calls[0][1];
      });

      /**
       *
       */
      test('it should be correct data variable structure when consumer callback is called', async () => {
        expect.assertions(2);

        mockWorker.mockImplementation(async (data: any) => {
          await data.next();
        });

        message.properties.timestamp = 9876543210987;

        await consumer(message);

        expect(mockWorker.mock.calls.length).toBe(1);
        expect(mockWorker.mock.calls[0]).toEqual([
          {
            log,
            created: expect.any(Date),
            payload,
            next: expect.any(Function),
            discard: expect.any(Function),
            defer: expect.any(Function),
          },
        ]);
      });

      /**
       *
       */
      test('it should be without confirmation the task when consumer callback is called', async (done) => {
        expect.assertions(5);

        service.on('error-task', async (err, data) => {
          try {
            expect(err).toBeInstanceOf(Error);
            expect(err.message).toBe('Task was not marked as completed.');

            expect(data).toEqual(payload);
          } catch (e) {
            done(e);
          }
        });

        await consumer(message);

        expect(mockChannelNack.mock.calls.length).toBe(1);
        expect(mockChannelNack.mock.calls[0]).toEqual([message, false, false]);

        done();
      });

      /**
       *
       */
      const testCallbacks: Array<[string, jest.Mock, boolean[]]> = [
        ['next', mockChannelAck, []],
        ['discard', mockChannelNack, [false, false]],
        ['defer', mockChannelNack, [false, true]],
      ];

      /**
       *
       */
      test.each(testCallbacks)(
        'it should be finalize the task when the %s() is called inside the consumer callback',
        async (cbName, mock, result) => {
          expect.assertions(3);

          mockWorker.mockImplementation(async (data: any) => {
            await data[cbName]();
          });

          await consumer(message);

          expect(mockWorker.mock.calls.length).toBe(1);

          expect(mock.mock.calls.length).toBe(1);
          expect(mock.mock.calls[0]).toEqual([message, ...result]);
        },
      );
    });
  });

  /**
   *
   */
  describe('Process flow to shutsdown', () => {
    /**
     *
     */
    test('it should be cancels without consumer', async () => {
      expect.assertions(3);

      await service.cancel();

      expect((service as any).consumerTag).toBeUndefined();
      expect(mockChannelCancel).toHaveBeenCalledTimes(0);
      expect((service as any).countTasks).toBe(0);
    });

    /**
     *
     */
    test('it should be cancels with consumer', async () => {
      expect.assertions(6);

      (service as any).countTasks = 2;
      (service as any).consumerTag = 'test-consumer-tag';

      (delay as any).mockImplementation((ms: number): any => {
        (service as any).countTasks -= 1;
      });

      await service.cancel();

      expect((service as any).consumerTag).toBe('test-consumer-tag');
      expect((service as any).countTasks).toBe(0);

      expect(delay).toHaveBeenCalledTimes(2);
      expect(delay).toHaveBeenCalledWith(expect.any(Number));

      expect(mockChannelCancel).toHaveBeenCalledTimes(1);
      expect(mockChannelCancel).toHaveBeenNthCalledWith(1, 'test-consumer-tag');
    });
  });
});
