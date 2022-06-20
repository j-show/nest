import { BaseException, ExceptionData } from './base';

export const EMPTY_PARAMETER = 'EMPTY_PARAMETER';
export const INVALID_PARAMETER = 'INVALID_PARAMETER';

//#region EmptyParameter

export interface EmptyParameterExceptionData extends ExceptionData {
  name: string;
}

export class EmptyParameterException extends BaseException {
  constructor(data: EmptyParameterExceptionData, status = 400) {
    super(EMPTY_PARAMETER, `Value of prarameter '${data.name}' is empty!`, data, status);
  }
}

//#endregion

//#region InvalidParameter

export interface InvalidParameterExceptionData extends ExceptionData {
  name: string;
  reason?: string;
}

export class InvalidParameterException extends BaseException {
  constructor(data: InvalidParameterExceptionData, status = 400) {
    super(INVALID_PARAMETER, `Invalid parameter '${data.name}'!`, data, status);
  }
}

//#endregion
