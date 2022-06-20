import chalk from 'chalk';
import { EventEmitter } from 'events';
import { flatten } from 'lodash';
import readline from 'readline';
import { Writable } from 'stream';
import tty from 'tty';

export const CLEAR_WHOLE_LINE = 0;

export const CLEAR_RIGHT_OF_CURSOR = 1;

type WriteStream = tty.WriteStream | NodeJS.WriteStream;

export class Screen {
  private _renderTimer = new RenderTimer();
  private _interceptor: Interceptor;
  private _destroyed = false;

  private _lines: Line[] = [];
  private _lastLines = 0;

  constructor(
    private readonly stdout: WriteStream = process.stdout,
    private readonly stderr: WriteStream = process.stderr,
  ) {
    this._interceptor = new Interceptor(stdout, stderr);
    this._interceptor.on();
    this._interceptor.events.on('write', () => {
      this.render();
    });
  }

  public get renderInterval() {
    return this._renderTimer.interval;
  }

  public set renderInterval(value) {
    this._renderTimer.interval = value;
  }

  private _render() {
    this._interceptor.off();
    for (let i = 0; i < this._lastLines; i++) {
      readline.clearLine(this.stdout, 0);
      readline.cursorTo(this.stdout, 0);
      readline.moveCursor(this.stdout, 0, -1);
    }
    this._flush();
    const lines = flatten(this._lines.map((x) => x.content.split('\n')));
    lines.unshift('');
    for (const line of lines) {
      this.stdout.write(`${line}\n`);
    }
    this._lastLines = lines.length;
    this._interceptor.on();
  }

  private _flush() {
    const chunks = this._interceptor.flush();
    for (const chunk of chunks) {
      this[chunk.type].write(chunk.chunk);
    }
  }

  public createLine() {
    const line = new Line(this);
    this._lines.push(line);
    return line;
  }

  public destroyLine(line: Line) {
    const pos = this._lines.findIndex((x) => x === line);
    if (pos >= 0) {
      this._lines.splice(pos, 1);
      this._render();
    }
  }

  public destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._renderTimer.destroy();
    this._lines.splice(0);
    this._render();
    this._interceptor.off();
  }

  public render() {
    this._renderTimer.next(() => {
      this._render();
    });
  }
}

export class Line {
  private _content!: string;

  constructor(private _screen: Screen) {
    this.content = '';
  }

  public get content() {
    return this._content;
  }

  public set content(value: string) {
    this._content = value;
    this._screen.render();
  }

  public destroy() {
    this._screen.destroyLine(this);
  }
}

export interface InterceptorChunk {
  type: 'stdout' | 'stderr';
  encoding: string;
  chunk: Buffer;
}

export class Interceptor {
  private _chunks: InterceptorChunk[] = [];
  private _origin_stdout_write: NodeJS.WritableStream['write'] | null = null;
  private _origin_stderr_write: NodeJS.WritableStream['write'] | null = null;
  public isOn = false;
  public readonly events = new EventEmitter();

  constructor(private readonly stdout: WriteStream, private readonly stderr: WriteStream) {}

  private _writeChunk(type: 'stdout' | 'stderr', chunk: Buffer, encoding: string) {
    const item: InterceptorChunk = { type, encoding, chunk };
    this._chunks.push(item);
    return item;
  }

  public on() {
    if (this.isOn) return;
    this.isOn = true;
    const stdout = new Writable();
    stdout._write = (buffer: Buffer, encoding, callback) => {
      const ret = this._writeChunk('stdout', buffer, encoding);
      callback();
      this.events.emit('write', ret);
    };
    const stderr = new Writable();
    stderr._write = (buffer: Buffer, encoding, callback) => {
      const ret = this._writeChunk('stderr', buffer, encoding);
      callback();
      this.events.emit('write', ret);
    };
    this._origin_stdout_write = this.stdout.write;
    this._origin_stderr_write = this.stderr.write;

    this.stdout.write = stdout.write.bind(stdout) as WriteStream['write'];
    this.stderr.write = stderr.write.bind(stderr) as WriteStream['write'];
  }

  public off() {
    if (!this.isOn) return;
    this.isOn = false;
    this.stdout.write = this._origin_stdout_write as WriteStream['write'];
    this.stderr.write = this._origin_stderr_write as WriteStream['write'];
    this._origin_stdout_write = null;
    this._origin_stderr_write = null;
  }

  public flush() {
    const ret = this._chunks;
    this._chunks = [];
    return ret;
  }
}

class RenderTimer<T = unknown> {
  private _triggerAt = 0;
  private _interval = 50;
  private _timer: { readonly value: NodeJS.Timeout } | null = null;
  private _nextCallback: { readonly value: () => T } | null = null;

  public get interval() {
    return this._interval;
  }

  public set interval(value) {
    value = Number(value);
    if (!(Number.isFinite(value) && value > 0)) {
      value = 0;
    }
    this._interval = value;
  }

  private _trigger(cb: () => T) {
    this._triggerAt = Date.now();
    process.nextTick(cb);
    this._setTimeout();
  }

  private _setTimeout() {
    const timer = setTimeout(() => {
      this._callback();
    }, this.interval);
    this._timer = { value: timer };
  }

  private _callback() {
    this._triggerAt = 0;
    if (this._nextCallback) {
      const fn = this._nextCallback.value;
      this._nextCallback = null;
      this._trigger(fn);
    }
  }

  private _clear() {
    if (this._timer) {
      clearTimeout(this._timer.value);
      this._timer = null;
    }
  }

  public next(cb: () => T) {
    if (this._triggerAt) {
      this._nextCallback = { value: cb };
    } else {
      this._trigger(cb);
    }
  }

  public destroy() {
    this._clear();
    this._nextCallback = null;
  }
}

export function toStartOfLine(stdout: WriteStream) {
  if (!chalk.supportsColor) {
    stdout.write('\r');
    return;
  }

  readline.cursorTo(stdout, 0);
}

export function writeOnNthLine(stdout: WriteStream, n: number, msg: string) {
  if (!chalk.supportsColor) {
    return;
  }

  if (n === 0) {
    readline.cursorTo(stdout, 0);
    stdout.write(msg);
    readline.clearLine(stdout, CLEAR_RIGHT_OF_CURSOR);
    return;
  }
  readline.cursorTo(stdout, 0);
  readline.moveCursor(stdout, 0, -n);
  stdout.write(msg);
  readline.clearLine(stdout, CLEAR_RIGHT_OF_CURSOR);
  readline.cursorTo(stdout, 0);
  readline.moveCursor(stdout, 0, n);
}

export function clearLine(stdout: WriteStream) {
  if (!chalk.supportsColor) {
    if (stdout instanceof tty.WriteStream) {
      if (stdout.columns > 0) {
        stdout.write(`\r${' '.repeat(stdout.columns - 1)}`);
      }
      stdout.write(`\r`);
    }
    return;
  }

  readline.clearLine(stdout, CLEAR_WHOLE_LINE);
  readline.cursorTo(stdout, 0);
}

export function clearNthLine(stdout: WriteStream, n: number) {
  if (!chalk.supportsColor) {
    return;
  }

  if (n === 0) {
    clearLine(stdout);
    return;
  }
  readline.cursorTo(stdout, 0);
  readline.moveCursor(stdout, 0, -n);
  readline.clearLine(stdout, CLEAR_WHOLE_LINE);
  readline.moveCursor(stdout, 0, n);
}

export function clearLastNLine(stdout: WriteStream, n: number) {
  if (!chalk.supportsColor) {
    return;
  }
  readline.clearLine(stdout, CLEAR_WHOLE_LINE);
  for (let i = 1; i < n; i++) {
    readline.cursorTo(stdout, 0);
    readline.moveCursor(stdout, 0, -1);
    readline.clearLine(stdout, CLEAR_WHOLE_LINE);
  }
}
