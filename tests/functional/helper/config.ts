export const amqpHost = process.env.AMQP_HOST || 'localhost';
export const amqpPort = process.env.AMQP_PORT || 5672;
export const amqpUser = process.env.AMQP_USER || 'guest';
export const amqpPassword = process.env.AMQP_PASSWORD || 'guest';
export const amqpUrl = `amqp://${amqpUser}:${amqpPassword}@${amqpHost}:${amqpPort}`;

export const delay = (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
};
