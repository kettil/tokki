import Joi from '@hapi/joi';
import pino from 'pino';

import tokki from '../src';

type payloadType = {
  update: 'rating' | 'summary';
};

// optional: logger
const log = pino();

// optional: schema definition
const schema = Joi.object().keys({
  update: Joi.string()
    .valid(['rating', 'summary'])
    .required(),
});

(async () => {
  // create a connection
  const amqp = await tokki({ url: 'amqp://...', log });

  // create a publisher instance
  const publisher = await amqp.publisher<payloadType>({ name: 'queue-name', schema, closeConnectionByError: true });

  publisher.on('error-task', async (err, payload) => {
    // If an error is thrown within a task,
    // then this event is triggered.
  });

  publisher.on('error', async (err) => {
    // If an error is thrown within the service,
    // e.g. if an error occurs in the 'error-task' event,
    // then this event is triggered.
    //
    // After the error the connection is closed,
    // if closeConnectionByError = true (default).
  });

  await publisher.setConsumer(async (data) => {
    data.log.info(`update type: ${data.payload.update}`);

    // If an error is thrown within the task, the task fails
    // and the event "error-task" is triggered.

    // job is successful
    await data.next();

    /*
    // or: job is failed (but requeue)
    await data.defer();
    // or: job is failed
    await data.discard();
    */
  });
})();
