import { stringify } from '@jshow/logger';
import { getConfig, safeShortenUUID } from '@jshow/nest-common';

import { LogstashSendData, LogstashTransport, LogstashTransportTCP, LogstashTransportUDP } from './transport';

const CONFIG_KEY_LOGSTASH_ENABLE = 'logger.logstash.enable';
const CONFIG_KEY_LOGSTASH_HOST = 'logger.logstash.host';
const CONFIG_KEY_LOGSTASH_PORT = 'logger.logstash.port';

export const getEnabledLogstash = (key = CONFIG_KEY_LOGSTASH_ENABLE) => {
  if (process.env.LOGSTASH === 'on') return true;
  return getConfig(key) === 'on';
};

let client: Logstash;
const enableLogstashClient = getEnabledLogstash();
const logstashHost = enableLogstashClient ? getConfig(CONFIG_KEY_LOGSTASH_HOST) : void 0;
const logstashPort = enableLogstashClient ? getConfig<number>(CONFIG_KEY_LOGSTASH_PORT) : void 0;

const getLogstashClient = () => {
  if (!logstashHost || !logstashPort) throw new Error('Invalid logstash pipeline config');
  if (client) return client;

  client = new Logstash('tcp', logstashHost, logstashPort);
  if (!process.env.LOGSTASH_CONTEXT_ID) process.env.LOGSTASH_CONTEXT_ID = client.id;

  return client;
};

export class Logstash {
  static async sendLog(level: string, message: string | Record<string, unknown>) {
    if (!enableLogstashClient) return;

    const instance = getLogstashClient();
    const sendObject: LogstashSendData = {
      '@timestamp': new Date(),
      message,
      level,
      contextId: process.env.LOGSTASH_CONTEXT_ID || instance.id,
      namespace: process.env.SENTRY_RELEASE || 'default',
    };

    await new Promise((resolve, reject) => {
      instance.send(sendObject, (err?: Error) => {
        if (err) return reject(err);
        resolve(true);
      });
    });
  }

  private _id: string;
  private _transport?: LogstashTransport;

  constructor(public readonly type: 'tcp' | 'udp', public readonly host: string, public readonly port: number) {
    this._id = safeShortenUUID();
  }

  public get id() {
    return this._id;
  }

  public get transport() {
    if (this._transport?.type === this.type) return this._transport;

    switch (this.type) {
      case 'tcp':
        this._transport = new LogstashTransportTCP(this.host, this.port);
        break;
      case 'udp':
      default:
        this._transport = new LogstashTransportUDP(this.host, this.port);
        break;
    }

    return this._transport;
  }

  public connect() {
    this.transport.connect();
  }

  public send<T extends LogstashSendData>(msg: T, cb: () => void) {
    this.transport.send(stringify(msg), cb);
  }
}
