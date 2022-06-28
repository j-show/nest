import makeLogger from 'debug';
import dgram from 'dgram';
import net from 'net';

export interface LogstashSendData {
  '@timestamp': Date;
  message: string | Record<string, unknown>;
  level: string;
  contextId: string;
  namespace: string;
}

export interface LogstashQueueData {
  message: string;
  callback: () => void;
}

export abstract class LogstashTransport {
  private _maxSize = -1;
  protected debug = makeLogger('logstash:transport');
  protected queue: LogstashQueueData[] = [];

  constructor(public readonly type: string) {}

  public abstract get connected(): boolean;

  protected abstract connectSocket(): void;
  protected abstract closeSocket(): void;
  protected abstract sendData(data: LogstashQueueData): void;

  public get maxSize(): number {
    return this._maxSize;
  }

  public set maxSize(value: number) {
    const _value = Math.floor(value);
    if (_value < 1) {
      this._maxSize = -1;
      return;
    }

    if (_value < this._maxSize) this.queue = this.queue.slice(Math.max(this.queue.length - _value, 0));

    this._maxSize = _value;
  }

  protected dequeue() {
    this.debug(`dequeuing ${this.queue.length} messages`);

    while (this.queue.length) {
      const data = this.queue.shift();
      if (!data) continue;

      this.sendData(data);
    }
  }

  public send(message: string, callback: () => void): void {
    if (this.connected) {
      this.debug(`sending message [${message}]`);
      return this.sendData({ message, callback });
    }

    this.debug('queueing message');
    this.queue.push({ message, callback });

    while (this.queue.length > this.maxSize) this.queue.shift();
  }

  public connect(): void {
    if (this.connected) this.closeSocket();
    this.connectSocket();
  }

  public close(): void {
    if (!this.connected) return;
    this.closeSocket();
  }
}

export class LogstashTransportTCP extends LogstashTransport {
  protected socket: net.Socket | null = null;
  protected isConnected = false;

  constructor(public readonly host: string, public readonly port: number) {
    super('tcp');
    this.debug('new instance of TCP');
  }

  public get connected() {
    return !!(this.socket?.connecting || this.isConnected);
  }

  protected connectSocket() {
    this.socket = net.createConnection(
      {
        host: this.host,
        port: this.port,
      },
      () => {
        this.isConnected = true;
        this.debug('tcp connected');
        this.dequeue();
      },
    );

    const handleClose = () => {
      this.isConnected = false;
      this.socket = null;
      this.debug('tcp disconnect');
    };

    this.socket.on('close', handleClose);

    this.socket.on('end', () => {
      handleClose();
      this.reconnectSocket();
    });

    this.socket.on('timeout', () => {
      this.socket?.end();
      this.reconnectSocket();
    });
  }

  protected reconnectSocket() {
    setTimeout(() => {
      this.connectSocket();
    }, 1000 * 5);
  }

  protected closeSocket() {
    if (this.socket == null) return;
    this.socket.end();
  }

  protected sendData(data: LogstashQueueData) {
    this.socket?.write(`${data.message}\n`, data.callback);
  }
}

export class LogstashTransportUDP extends LogstashTransport {
  protected socket: dgram.Socket | null = null;
  protected isConnected = false;

  constructor(public readonly host: string, public readonly port: number) {
    super('udp');
    this.debug('new instance of UDP');
  }

  public get connected() {
    return this.isConnected;
  }

  protected connectSocket() {
    this.socket = dgram.createSocket('udp4');
    this.isConnected = true;
  }

  protected closeSocket() {
    if (this.socket == null) return;
    this.isConnected = false;
    this.socket.close();
    this.socket = null;
  }

  protected sendData(data: LogstashQueueData) {
    const buffer = Buffer.from(data.message);
    this.socket?.send(buffer, 0, buffer.length, this.port, this.host, data.callback);
  }
}
