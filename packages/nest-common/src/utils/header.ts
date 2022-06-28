/* eslint-disable */

import { ServerResponse } from 'http';

type Listener = () => void;

const createWriteHead = (preWriteHead: ServerResponse['writeHead'], listener: Listener) => {
  let fired = false;

  return function writeHead(this: ServerResponse) {
    // @ts-ignore
    let args: unknown[] = getWriteHeadArguments.call(this, arguments);

    if (!fired) {
      fired = true;
      listener.call(this);

      if (typeof args[0] === 'number' && this.statusCode !== args[0]) {
        args = [this.statusCode];
      }
    }

    // @ts-ignore
    return preWriteHead.apply(this, args);
  };
};

function getWriteHeadArguments(this: ServerResponse, args: unknown[]) {
  const length = args.length;
  const index = length > 1 && typeof args[1] === 'string' ? 2 : 1;
  const headers = length >= index + 1 ? args[index] : void 0;

  this.statusCode = args[0] as number;

  if (Array.isArray(headers)) {
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      this.setHeader(header[0], header[1]);
    }
  } else if (headers && typeof headers === 'object') {
    const keys = Object.keys(headers);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (k) this.setHeader(k, headers[k]);
    }
  }

  const _args = new Array(Math.min(length, index));
  for (let i = 0; i < _args.length; i++) _args[i] = args[i];

  return _args;
}

export function onHeaders(res: ServerResponse, listener: Listener) {
  if (!res) throw new TypeError('argument res is required');
  if (typeof listener !== 'function') throw new TypeError('argument listener must be a function');

  res.writeHead = createWriteHead(res.writeHead, listener) as unknown as ServerResponse['writeHead'];
}
