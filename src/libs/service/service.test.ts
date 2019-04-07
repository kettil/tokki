const mockChannelPublish = jest.fn();
const mockChannelConsume = jest.fn();
const mockChannelCancel = jest.fn();
const mockChannelClose = jest.fn();
const mockChannelNack = jest.fn();
const mockChannelAck = jest.fn();
const mockServicesGet = jest.fn();
const mockErrorServiceEmit = jest.fn();
const mockShutdownHandlerEmit = jest.fn();
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
      info: () => {}, // tslint:disable-line: no-empty
      error: mockLogError,
      fatal: mockLogFatal,
    } as any;

    errorService = {
      emit: mockErrorServiceEmit,
    };

    services = {
      get: mockServicesGet,
    };

    instance = {
      channel,
      services,
      shutdownHandler: {
        emit: mockShutdownHandlerEmit,
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
    expect((service as any).shutdownHandler).toBe(instance.shutdownHandler);
    expect((service as any).consumerTags).toEqual([]);

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
    test('it should be thrown a error if init() was not overwritten', async () => {
      expect.assertions(2);

      try {
        await service.init();
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('Initialization is not implemented.');
      }
    });

    /**
     *
     */
    const testErrorHandlingValue = [
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
        expect(mockErrorServiceEmit.mock.calls.length).toBe(1);

        expect(mockErrorServiceEmit.mock.calls[0][0]).toBe('write');
        expect(mockErrorServiceEmit.mock.calls[0][1].payload).toEqual(payload);
        expect(mockErrorServiceEmit.mock.calls[0][1].queue).toBe(name);
        expect(mockErrorServiceEmit.mock.calls[0][1].name).toBe(errName);
        expect(mockErrorServiceEmit.mock.calls[0][1].message).toBe(errMsg);
        expect(Array.isArray(mockErrorServiceEmit.mock.calls[0][1].stack)).toBe(true);

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
      expect(mockErrorServiceEmit.mock.calls.length).toBe(1);
      expect(mockErrorServiceEmit.mock.calls[0]).toEqual([
        'write',
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
      expect(mockErrorServiceEmit.mock.calls.length).toBe(0);
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
  describe('Process flow from publisher', () => {
    /**
     *
     */
    test('it should be register a write event', async () => {
      await service.registerPublishEvent();

      expect((service as any).handler.eventNames()).toEqual(expect.arrayContaining(['write']));
      expect((service as any).handler.listenerCount('write')).toBe(1);
    });

    /**
     *
     */
    test('it should be call the write event', async () => {
      const payload = { a: 'z', b: 42, t: true };

      await service.registerPublishEvent();

      await service.emit('write', payload);

      expect(mockChannelPublish.mock.calls.length).toBe(1);
      expect(mockChannelPublish.mock.calls[0]).toEqual([
        name,
        '',
        Buffer.from(JSON.stringify(payload)),
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
    test('it should be register a data event', async () => {
      mockChannelConsume.mockResolvedValue({ consumerTag: 'test-consumer-tag' });

      await service.registerConsumeEvent();

      expect(mockChannelConsume.mock.calls.length).toBe(1);
      expect(mockChannelConsume.mock.calls[0][0]).toBe(name);
      expect(typeof mockChannelConsume.mock.calls[0][1]).toBe('function');
      expect(mockChannelConsume.mock.calls[0][2]).toEqual({ noAck: false });
      expect((service as any).consumerTags).toEqual(['test-consumer-tag']);
    });

    /**
     *
     */
    test('it should be worked up a data event with NULL', async () => {
      mockChannelConsume.mockResolvedValue({ consumerTag: 'test-consumer-tag' });

      log.info = jest.fn();

      await service.registerConsumeEvent();

      const consumer = mockChannelConsume.mock.calls[0][1];

      await consumer(null);

      expect(log.info.mock.calls.length).toBe(2);
      expect(log.info.mock.calls[1]).toEqual(['[AMQP] New job without consume message']);
    });

    /**
     *
     */
    test('it should be worked up a data event and throw a error in the event function', async () => {
      mockChannelConsume.mockResolvedValue({ consumerTag: 'test-consumer-tag' });

      await service.registerConsumeEvent();

      const consumer = mockChannelConsume.mock.calls[0][1];
      const payload = { a: 'z', b: 42, t: true };
      const message = { content: Buffer.from(JSON.stringify(payload)), properties: { messageId: '13579' } };

      expect.assertions(7);

      service.on('data', async (data) => {
        throw Error('event-exception');
      });

      // call data event
      await consumer(message);

      expect(mockShutdownHandlerEmit.mock.calls.length).toBe(2);
      expect(mockShutdownHandlerEmit.mock.calls[0]).toEqual(['start', name]);
      expect(mockShutdownHandlerEmit.mock.calls[1]).toEqual(['finish', name]);

      expect(mockChannelNack.mock.calls.length).toBe(1);
      expect(mockChannelNack.mock.calls[0]).toEqual([message, false, false]);

      expect(mockLogError.mock.calls.length).toBe(1);
      expect(mockLogError.mock.calls[0]).toEqual([{ err: new Error('event-exception') }, '[AMQP] Job has an error.']);
    });

    /**
     *
     */
    describe('Check the data sub function', () => {
      let payload: any;
      let message: any;
      let consumer: any;

      /**
       *
       */
      beforeEach(async () => {
        payload = { a: 'z', b: 42, t: true };
        message = { content: Buffer.from(JSON.stringify(payload)), properties: { messageId: '13579' } };

        mockChannelConsume.mockResolvedValue({ consumerTag: 'test-consumer-tag' });

        await service.registerConsumeEvent();

        consumer = mockChannelConsume.mock.calls[0][1];
      });

      /**
       *
       */
      test('it should be worked up a data event and test the data variable structure', async () => {
        expect.assertions(8);

        service.on('data', async (data) => {
          expect(data.log).toBe(log);
          expect(data.payload).toEqual(payload);
          expect(typeof data.next).toBe('function');
          expect(typeof data.discard).toBe('function');
          expect(typeof data.defer).toBe('function');
          expect(typeof data.write).toBe('function');
        });

        // call data event
        await consumer(message);

        expect(mockShutdownHandlerEmit.mock.calls.length).toBe(1);
        expect(mockShutdownHandlerEmit.mock.calls[0]).toEqual(['start', name]);
      });

      /**
       *
       */
      const testCallbacks = [
        ['next', mockChannelAck, []],
        ['discard', mockChannelNack, [false, false]],
        ['defer', mockChannelNack, [false, true]],
      ];

      /**
       *
       */
      test.each(testCallbacks)(
        'it should be worked up a data event and call "%s" function',
        async (cbName, mock, result) => {
          expect.assertions(5);

          service.on('data', async (data) => {
            await data[cbName]();
          });

          // call data event
          await consumer(message);

          expect(mockShutdownHandlerEmit.mock.calls.length).toBe(2);
          expect(mockShutdownHandlerEmit.mock.calls[0]).toEqual(['start', name]);
          expect(mockShutdownHandlerEmit.mock.calls[1]).toEqual(['finish', name]);
          expect(mock.mock.calls.length).toBe(1);
          expect(mock.mock.calls[0]).toEqual([message, ...result]);
        },
      );

      /**
       *
       */
      test('it should be worked up a data event and call "write" function', async () => {
        expect.assertions(7);

        const mockEmit = jest.fn();

        // change global mockup
        mockServicesGet.mockReturnValue({ emit: mockEmit });

        service.on('data', async (data) => {
          await data.write('other-queue', { a: 'b', c: 1 });
          await data.next();
        });

        // call data event
        await consumer(message);

        expect(mockServicesGet.mock.calls.length).toBe(1);
        expect(mockServicesGet.mock.calls[0]).toEqual(['other-queue']);

        expect(mockShutdownHandlerEmit.mock.calls.length).toBe(2);
        expect(mockShutdownHandlerEmit.mock.calls[0]).toEqual(['start', name]);
        expect(mockShutdownHandlerEmit.mock.calls[1]).toEqual(['finish', name]);

        expect(mockEmit.mock.calls.length).toBe(1);
        expect(mockEmit.mock.calls[0]).toEqual(['write', { a: 'b', c: 1 }]);

        // reset changes from global mockup
        mockServicesGet.mockReset();
      });

      /**
       *
       */
      test('it should be worked up a data event and call "write" function with unknown service', async () => {
        expect.assertions(9);

        service.on('data', async (data) => {
          await data.write('unknown-queue', { a: 'b', c: 1 });
        });

        // call data event
        await consumer(message);

        expect(mockServicesGet.mock.calls.length).toBe(1);
        expect(mockServicesGet.mock.calls[0]).toEqual(['unknown-queue']);

        expect(mockShutdownHandlerEmit.mock.calls.length).toBe(2);
        expect(mockShutdownHandlerEmit.mock.calls[0]).toEqual(['start', name]);
        expect(mockShutdownHandlerEmit.mock.calls[1]).toEqual(['finish', name]);

        expect(mockLogError.mock.calls.length).toBe(1);
        expect(mockLogError.mock.calls[0]).toEqual([
          { err: new Error('Service "unknown-queue" is unknown') },
          '[AMQP] Job has an error.',
        ]);

        expect(mockChannelNack.mock.calls.length).toBe(1);
        expect(mockChannelNack.mock.calls[0]).toEqual([message, false, false]);
      });
    });
  });

  /**
   *
   */
  describe('Process flow to shutsdown', () => {
    const testValues = [['null consumers', 0], ['one consumer', 1], ['three consumers', 3]];

    /**
     *
     */
    test.each(testValues)('it should be cancels consumers (%s)', async (d, count) => {
      expect.assertions(1 + count);

      for (let i = 1; i <= count; i += 1) {
        mockChannelConsume.mockResolvedValueOnce({ consumerTag: 'test-consumer-tag-' + i });
      }

      for (let i = 1; i <= count; i += 1) {
        await service.registerConsumeEvent();
      }

      await service.cancel();

      expect(mockChannelCancel.mock.calls.length).toBe(count);
      for (let i = 1; i <= count; i += 1) {
        expect(mockChannelCancel.mock.calls[i - 1]).toEqual(['test-consumer-tag-' + i]);
      }
    });
  });
});
