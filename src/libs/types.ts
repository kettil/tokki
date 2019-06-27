import Joi from '@hapi/joi';

import Service from './services/service';

/**
 *
 */
export type connectArgsType = {
  url: string;
  log?: InterfaceLogger;
  prefetch?: number;
  options?: any;
};

/**
 *
 */
export type serviceArgsType = {
  name: string;
  errorService?: Service;
  schema?: Joi.ObjectSchema;
  closeConnectionByError?: boolean;
};

/**
 *
 */
export type servicesType = Map<string, Service>;

/**
 *
 */
export type objectType = { [key: string]: any };

/**
 *
 */
export type publishOptionsType = {
  priority?: number;
};

/**
 *
 */
export type consumerDataType<Payload> = {
  log: InterfaceLogger;
  created?: Date;
  payload: Payload;
  next: () => Promise<void>;
  discard: () => Promise<void>;
  defer: () => Promise<void>;
};

/**
 *
 */
export type errorPayloadType<Payload> = {
  queue: string;
  payload: Payload | string;
  name: string;
  message: string;
  stack: string;
};

/**
 *
 */
export type processTriggerType = (params: {
  readonly code?: number;
  readonly exception?: Error;
  readonly signal?: NodeJS.Signals;
}) => Promise<void>;

/**
 *
 */
export type consumerType<PayloadType> = (data: consumerDataType<PayloadType>) => Promise<void>;

/**
 *
 */
export interface InterfaceLog {
  (msg: string, ...params: any[]): void;
  (obj: {}, msg: string, ...params: any[]): void;
}

/**
 *
 */
export interface InterfaceLogger {
  debug: InterfaceLog;
  info: InterfaceLog;
  warn: InterfaceLog;
  error: InterfaceLog;
  fatal: InterfaceLog;

  child: (options: Record<string, any>) => InterfaceLogger;
}

/**
 *
 */
export type SubType<Base, Cond> = Pick<Base, { [Key in keyof Base]: Base[Key] extends Cond ? Key : never }[keyof Base]>;
