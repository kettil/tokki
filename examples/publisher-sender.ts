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
  const publisher = await amqp.publisher<payloadType>({ name: 'queue-name', schema });

  // publish the event
  await publisher.send({ update: 'summary' });
})();
