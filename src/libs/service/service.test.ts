const mockChannelPublish = jest.fn();
const mockChannelConsume = jest.fn(() => Promise.resolve({ consumerTag: 'abcdef' }));
const mockChannelCancel = jest.fn();
const mockChannelClose = jest.fn();
const mockChannelNack = jest.fn();
const mockChannelAck = jest.fn();
const mockServicesGet = jest.fn();
const mockErrorServiceSend = jest.fn();
const mockCloseHandlerStart = jest.fn();
const mockCloseHandlerFinish = jest.fn();
const mockLogInfo = jest.fn();
const mockLogError = jest.fn();
const mockLogFatal = jest.fn();

import Service from './service';

/**
 *
 */
describe('Check the class Service', () => {
  let service: Service;
  let errorService: any;
  let services: { [k: string]: any };
  let instance: any;
  let channel: { [k: string]: any };
  let log: any;

  const name = 'test-queue';

  /**
   *
   */
  beforeEach(() => {
    channel = {
      publish: mockChannelPublish,
      consume: mockChannelConsume,
      cancel: mockChannelCancel,
      close: mockChannelClose,
      nack: mockChannelNack,
      ack: mockChannelAck,
    };

    log = {
      child: () => log,
      debug: () => {}, // tslint:disable-line: no-empty
      info: mockLogInfo,
      error: mockLogError,
      fatal: mockLogFatal,
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
      closeHandler: {
        start: mockCloseHandlerStart,
        finish: mockCloseHandlerFinish,
      },
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
    expect((service as any).channel).toBe(channel);
    expect((service as any).services).toBe(services);
    expect((service as any).closeHandler).toBe(instance.closeHandler);
    expect((service as any).isInitialized).toEqual({ global: false, consumer: false, sender: false });
    expect((service as any).consumerTag).toEqual(undefined);

    expect((service as any).log).toBe(log);
    expect((service as any).name).toBe(name);
    expect((service as any).error).toBe(errorService);
  });

  /**
   *
   */
  describe('Checks functions directly', () => {
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
        const payload = { a: 'z', b: 42, t: true };
        const message: any = { content: Buffer.from(JSON.stringify(payload)) };

        await service.errorHandling(log, message, err);

        expect(mockChannelNack.mock.calls.length).toBe(1);
        expect(mockChannelNack.mock.calls[0]).toEqual([message, false, false]);
        expect(mockErrorServiceSend.mock.calls.length).toBe(1);
        expect(mockErrorServiceSend.mock.calls[0][0].payload).toEqual(payload);
        expect(mockErrorServiceSend.mock.calls[0][0].queue).toBe(name);
        expect(mockErrorServiceSend.mock.calls[0][0].name).toBe(errName);
        expect(mockErrorServiceSend.mock.calls[0][0].message).toBe(errMsg);
        expect(Array.isArray(mockErrorServiceSend.mock.calls[0][0].stack)).toBe(true);

        expect(mockLogError.mock.calls.length).toBe(1);
        expect(mockLogError.mock.calls[0]).toEqual([{ err }, '[AMQP] Job has an error.']);
      },
    );

    /**
     *
     */
    test('it should be handled in errorHandling() an error object without stack', async () => {
      const err = new Error('test-error');
      const payload = { a: 'z', b: 42, t: true };
      const message: any = { content: Buffer.from(JSON.stringify(payload)) };

      err.stack = undefined;

      await service.errorHandling(log, message, err);

      expect(mockChannelNack.mock.calls.length).toBe(1);
      expect(mockChannelNack.mock.calls[0]).toEqual([message, false, false]);
      expect(mockErrorServiceSend.mock.calls.length).toBe(1);
      expect(mockErrorServiceSend.mock.calls[0]).toEqual([
        {
          payload,
          queue: name,
          name: err.name,
          message: 'test-error',
          stack: [],
        },
      ]);

      expect(mockLogError.mock.calls.length).toBe(1);
      expect(mockLogError.mock.calls[0]).toEqual([{ err }, '[AMQP] Job has an error.']);
    });

    /**
     *
     */
    test('it should be handled in errorHandling() an error object and throw a sub error', async () => {
      const err1 = 'test-error';
      const err2 = 'test-channel-error';
      const payload = { a: 'z', b: 42, t: true };
      const message: any = { content: Buffer.from(JSON.stringify(payload)) };

      // change global mockup
      mockChannelNack.mockImplementation(() => {
        throw new Error(err2);
      });

      expect.assertions(8);

      await service.errorHandling(log, message, new Error(err1));

      expect(mockChannelNack.mock.calls.length).toBe(1);
      expect(mockChannelNack.mock.calls[0]).toEqual([message, false, false]);
      expect(mockErrorServiceSend.mock.calls.length).toBe(0);
      expect(mockChannelClose.mock.calls.length).toBe(1);

      expect(mockLogError.mock.calls.length).toBe(1);
      expect(mockLogError.mock.calls[0]).toEqual([{ err: new Error(err1) }, '[AMQP] Job has an error.']);

      expect(mockLogFatal.mock.calls.length).toBe(1);
      expect(mockLogFatal.mock.calls[0]).toEqual([
        { err: new Error(err2), errPrevent: new Error(err1) },
        '[AMQP] Error handling from job is failed.',
      ]);

      // reset changes from global mockup
      mockChannelNack.mockReset();
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
      const mockGlobal = jest.fn();
      const mockSender = jest.fn();
      const payload = {
        a: 'z',
        n: 23,
      };

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
        { persistent: true },
      ]);
    });

    /**
     *
     */
    test('it should be publish when function send() is called twice', async () => {
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
        { persistent: true },
      ]);
      expect(mockChannelPublish.mock.calls[1]).toEqual([
        'test-queue',
        '',
        Buffer.from(JSON.stringify({ a: 2 }), 'utf8'),
        { persistent: true },
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
      expect(mockLogInfo.mock.calls[1]).toEqual(['[AMQP] New job without consume message']);
    });

    /**
     *
     */
    test('it should be internal consumer catched an error when consumer callback throw an error', async () => {
      expect.assertions(10);

      const errorMessage = 'error-message';
      const mockWorker = jest.fn(() => Promise.reject(new Error(errorMessage)));
      const payload = { a: 'z', b: 42, t: true };
      const message = { content: Buffer.from(JSON.stringify(payload)), properties: { messageId: '13579' } };

      await service.setConsumer(mockWorker);

      expect(mockChannelConsume.mock.calls.length).toBe(1);
      expect(mockChannelConsume.mock.calls[0]).toEqual(['test-queue', expect.any(Function), { noAck: false }]);

      const consumer: any = mockChannelConsume.mock.calls[0][1 as any];

      await consumer(message);

      expect(mockCloseHandlerStart.mock.calls.length).toBe(1);
      expect(mockCloseHandlerStart.mock.calls[0]).toEqual([name]);
      expect(mockCloseHandlerFinish.mock.calls.length).toBe(1);
      expect(mockCloseHandlerFinish.mock.calls[0]).toEqual([name]);

      expect(mockChannelNack.mock.calls.length).toBe(1);
      expect(mockChannelNack.mock.calls[0]).toEqual([message, false, false]);

      expect(mockLogError.mock.calls.length).toBe(1);
      expect(mockLogError.mock.calls[0]).toEqual([{ err: new Error(errorMessage) }, '[AMQP] Job has an error.']);
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

        consumer = mockChannelConsume.mock.calls[0][1 as any];
      });

      /**
       *
       */
      test('it should be correct data variable structure when consumer callback is called', async () => {
        expect.assertions(6);

        mockWorker.mockImplementation(async (data: any) => {
          await data.next();
        });

        await consumer(message);

        expect(mockCloseHandlerStart.mock.calls.length).toBe(1);
        expect(mockCloseHandlerStart.mock.calls[0]).toEqual([name]);
        expect(mockCloseHandlerFinish.mock.calls.length).toBe(1);
        expect(mockCloseHandlerFinish.mock.calls[0]).toEqual([name]);

        expect(mockWorker.mock.calls.length).toBe(1);
        expect(mockWorker.mock.calls[0]).toEqual([
          {
            log,
            payload,
            next: expect.any(Function),
            discard: expect.any(Function),
            defer: expect.any(Function),
            write: expect.any(Function),
          },
        ]);
      });

      /**
       *
       */
      test('it should be without confirmation the job when consumer callback is called', async () => {
        expect.assertions(8);

        await consumer(message);

        expect(mockCloseHandlerStart.mock.calls.length).toBe(1);
        expect(mockCloseHandlerStart.mock.calls[0]).toEqual([name]);
        expect(mockCloseHandlerFinish.mock.calls.length).toBe(1);
        expect(mockCloseHandlerFinish.mock.calls[0]).toEqual([name]);

        expect(mockChannelNack.mock.calls.length).toBe(1);
        expect(mockChannelNack.mock.calls[0]).toEqual([message, false, false]);

        expect(mockLogError.mock.calls.length).toBe(1);
        expect(mockLogError.mock.calls[0]).toEqual([
          { err: new Error('Job was not marked as completed.') },
          '[AMQP] Job has an error.',
        ]);
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
        'it should be finalize the job when the %s() is called inside the consumer callback',
        async (cbName, mock, result) => {
          expect.assertions(7);

          mockWorker.mockImplementation(async (data: any) => {
            await data[cbName]();
          });

          await consumer(message);

          expect(mockCloseHandlerStart.mock.calls.length).toBe(1);
          expect(mockCloseHandlerStart.mock.calls[0]).toEqual([name]);
          expect(mockCloseHandlerFinish.mock.calls.length).toBe(1);
          expect(mockCloseHandlerFinish.mock.calls[0]).toEqual([name]);

          expect(mockWorker.mock.calls.length).toBe(1);

          expect(mock.mock.calls.length).toBe(1);
          expect(mock.mock.calls[0]).toEqual([message, ...result]);
        },
      );

      /**
       *
       */
      test('it should be call a other service when the write() is called inside the consumer callback', async () => {
        expect.assertions(11);

        const mockSend = jest.fn();

        // change global mockup
        mockServicesGet.mockReturnValue({ send: mockSend });

        mockWorker.mockImplementation(async (data: any) => {
          await data.write('other-queue', { a: 'b', c: 1 });
          await data.next();
        });

        await consumer(message);

        expect(mockServicesGet.mock.calls.length).toBe(1);
        expect(mockServicesGet.mock.calls[0]).toEqual(['other-queue']);

        expect(mockSend.mock.calls.length).toBe(1);
        expect(mockSend.mock.calls[0]).toEqual([{ a: 'b', c: 1 }]);

        expect(mockCloseHandlerStart.mock.calls.length).toBe(1);
        expect(mockCloseHandlerStart.mock.calls[0]).toEqual([name]);
        expect(mockCloseHandlerFinish.mock.calls.length).toBe(1);
        expect(mockCloseHandlerFinish.mock.calls[0]).toEqual([name]);

        expect(mockWorker.mock.calls.length).toBe(1);

        expect(mockChannelAck.mock.calls.length).toBe(1);
        expect(mockChannelAck.mock.calls[0]).toEqual([message]);

        mockServicesGet.mockReset();
      });

      /**
       *
       */
      test('it should be call a unknown service when the write() is called inside the consumer callback', async () => {
        expect.assertions(11);

        mockWorker.mockImplementation(async (data: any) => {
          await data.write('unknown-queue', { a: 'b', c: 1 });
        });

        await consumer(message);

        expect(mockServicesGet.mock.calls.length).toBe(1);
        expect(mockServicesGet.mock.calls[0]).toEqual(['unknown-queue']);

        expect(mockLogError.mock.calls.length).toBe(1);
        expect(mockLogError.mock.calls[0]).toEqual([
          { err: new Error('Service "unknown-queue" is unknown') },
          '[AMQP] Job has an error.',
        ]);

        expect(mockCloseHandlerStart.mock.calls.length).toBe(1);
        expect(mockCloseHandlerStart.mock.calls[0]).toEqual([name]);
        expect(mockCloseHandlerFinish.mock.calls.length).toBe(1);
        expect(mockCloseHandlerFinish.mock.calls[0]).toEqual([name]);

        expect(mockWorker.mock.calls.length).toBe(1);

        expect(mockChannelNack.mock.calls.length).toBe(1);
        expect(mockChannelNack.mock.calls[0]).toEqual([message, false, false]);
      });
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
      expect.assertions(1);

      await service.cancel();

      expect(mockChannelCancel.mock.calls.length).toBe(0);
    });

    /**
     *
     */
    test('it should be cancels with consumer', async () => {
      expect.assertions(2);

      (service as any).consumerTag = 'test-consumer-tag';

      await service.cancel();

      expect(mockChannelCancel.mock.calls.length).toBe(1);
      expect(mockChannelCancel.mock.calls[0]).toEqual(['test-consumer-tag']);
    });
  });
});
