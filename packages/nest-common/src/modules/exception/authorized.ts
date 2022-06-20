import { BaseException, ExceptionData } from './base';

export const ACCESS_DENIED = 'ACCESS_DENIED';
export const UNAUTHORIZED = 'UNAUTHORIZED';

//#region AccessDenied

export interface AccessDeniedData extends ExceptionData {
  className: string;
  memberName: string;
  featuresRequired: string;
}

export class AccessDeniedException extends BaseException {
  constructor(data: AccessDeniedData, status = 403) {
    super(
      ACCESS_DENIED,
      `Forbidden resource: ${data.className}@${data.memberName}, required features:${data.featuresRequired || ''}`,
      data,
      status,
    );
  }
}

//#endregion

//#region Unauthorized

export interface UnauthorizedExceptionData extends ExceptionData {
  message: string;
}
export class UnauthorizedException extends BaseException {
  constructor(data: UnauthorizedExceptionData, status = 401) {
    super(UNAUTHORIZED, data.message, data, status);
  }
}

//#endregion
