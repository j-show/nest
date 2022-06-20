export function ensureError(errorLikeOrMessage: string | Error | unknown, headMessage?: string) {
  if (typeof errorLikeOrMessage === 'string') {
    if (headMessage) return new Error(`${headMessage};  ${errorLikeOrMessage}`);
    return new Error(errorLikeOrMessage);
  }

  if (errorLikeOrMessage instanceof Error) {
    if (headMessage) errorLikeOrMessage.message = `${headMessage};  ${errorLikeOrMessage.message}`;
    return errorLikeOrMessage;
  }

  if (typeof errorLikeOrMessage === 'object' && errorLikeOrMessage && Reflect.has(errorLikeOrMessage, 'message')) {
    if (headMessage) return new Error(`${headMessage};  ${Reflect.get(errorLikeOrMessage, 'message')}`);
    return new Error(Reflect.get(errorLikeOrMessage, 'message') || '<unknown>');
  }

  if (headMessage) return new Error(`${headMessage};  ${JSON.stringify(errorLikeOrMessage)}`);

  return new Error(JSON.stringify(errorLikeOrMessage));
}

export function ensureErrorMessage(errorLikeOrMessage: string | Error | unknown) {
  if (typeof errorLikeOrMessage === 'string') return errorLikeOrMessage;

  if (errorLikeOrMessage instanceof Error) return errorLikeOrMessage.message;

  if (typeof errorLikeOrMessage === 'object' && errorLikeOrMessage && Reflect.has(errorLikeOrMessage, 'message')) {
    return Reflect.get(errorLikeOrMessage, 'message') as string;
  }

  return JSON.stringify(errorLikeOrMessage);
}
