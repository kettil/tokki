import Service from './service/service';

/**
 *
 */
export type servicesType = Map<string, Service>;

/**
 *
 */
export type consumerDataType<Payload> = {
  log: loggerType;
  payload: Payload;
  next: () => Promise<void>;
  discard: () => Promise<void>;
  defer: () => Promise<void>;
  write: (name: string, payload: objectType) => Promise<void>;
};

/**
 *
 */
export type objectType = { [key: string]: any };

/**
 *
 */
export type errorPayloadType<Payload> = {
  queue: string;
  payload: Payload;
  name: string;
  message: string;
  stack: string[];
};

/**
 *
 */
export type processTriggerType = (params: {
  readonly code?: number;
  readonly exception?: Error;
  readonly signal?: NodeJS.Signals;
}) => void;

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
export type loggerType = {
  debug: InterfaceLog;
  info: InterfaceLog;
  warn: InterfaceLog;
  error: InterfaceLog;
  fatal: InterfaceLog;

  child: (data?: { [k: string]: any }) => loggerType;

  [k: string]: any;
};
