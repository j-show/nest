import { HttpException } from '@nestjs/common';

export const UNKNOWN_ERROR = 'UNKNOWN_ERROR';
export const RUNTIME_EXCEPTION = 'RUNTIME_EXCEPTION';
export const CONFLICT = 'CONFLICT';
export const DUPLICATED_DEFINITION = 'DUPLICATED_DEFINITION';

//#region Base

export interface ExceptionData {
  [key: string]: unknown;
}

export class BaseException extends HttpException {
  public readonly code: string;
  public readonly data: ExceptionData;

  constructor(code: string, message: string | object, data: ExceptionData, status: number) {
    super(message, status);
    this.code = code;
    this.data = data;
  }
}

//#endregion

//#region Runtime

export class RuntimeException extends BaseException {
  constructor(message: string, status = 500, data: ExceptionData = {}) {
    super(RUNTIME_EXCEPTION, message, data, status);
  }
}

//#endregion

//#region Conflict

export interface ConflictExceptionData extends ExceptionData {
  entity: string;
  conditions?: string;
}

export class ConflictException extends BaseException {
  constructor(data?: ConflictExceptionData | string, status = 409) {
    if (!data) {
      super(CONFLICT, CONFLICT, {}, status);
    } else if (typeof data === 'string') {
      super(CONFLICT, data, {}, status);
    } else {
      super(CONFLICT, `${data.entity} with ${data.conditions} has been taken`, data, status);
    }
  }
}

//#endregion

//#region DuplicatedDefinition

export interface DuplicatedDefinitionExceptionData<T = 'option' | 'argument'> extends ExceptionData {
  name: string;
  type: T;
}

export class DuplicatedDefinitionException extends BaseException {
  constructor(data: DuplicatedDefinitionExceptionData, status = 500) {
    super(DUPLICATED_DEFINITION, `Duplicated ${data.type} definition by name: ${data.name}`, data, status);
  }
}

//#endregion
