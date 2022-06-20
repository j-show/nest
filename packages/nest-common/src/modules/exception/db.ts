import { BaseException, ExceptionData } from './base';

export const INVALID_DBID = 'INVALID_DBID';
export const INVALID_SCHEMA = 'INVALID_SCHEMA';
export const INVALID_DATA = 'INVALID_DATA';
export const NOT_FOUND_BY_ID = 'NOT_FOUND_BY_ID';
export const ARCHIVED_BY_ID = 'ARCHIVED_BY_ID';

//#region InvalidObjectId

interface InvalidObjectIdExceptionData extends ExceptionData {
  value?: string;
}

export class InvalidObjectIdException extends BaseException {
  constructor(data: InvalidObjectIdExceptionData, status = 400) {
    super(INVALID_DBID, `Can not create ObjectId using '${data.value}'!`, data, status);
  }
}

//#endregion

//#region InvalidSchema

export interface InvalidSchemaExceptionData extends ExceptionData {
  schema_name: string;
  property_name?: string;
  error?: Error;
}

export class InvalidSchemaException extends BaseException {
  constructor(data: InvalidSchemaExceptionData, status = 400) {
    super(
      data.property_name
        ? `${INVALID_SCHEMA}.${data.schema_name}.${data.property_name}`
        : `${INVALID_SCHEMA}.${data.schema_name}`,
      ` Invalid schema '${data.schema_name}' & Invalid property '${data.property_name}'!`,
      data,
      status,
    );
  }
}

//#endregion

//#region NotFoundById

export interface NotFoundByIdExceptionData extends ExceptionData {
  entity: string;
  id: string;
}

export class NotFoundByIdException extends BaseException {
  constructor(data: NotFoundByIdExceptionData, status = 404) {
    super(NOT_FOUND_BY_ID, `Can't find ${data.entity} by id '${data.id}'!`, data, status);
  }
}

//#endregion

//#region ArchivedById

export interface ArchivedByIdExceptionData extends ExceptionData {
  entity: string;
  id: string;
}

export class ArchivedByIdException extends BaseException {
  constructor(data: ArchivedByIdExceptionData, status = 404) {
    super(ARCHIVED_BY_ID, `Already archived ${data.entity} by id '${data.id}'!`, data, status);
  }
}

//#endregion

//#endregion InvalidData

export interface InvalidDataExceptionData extends ExceptionData {
  entity: string;
  id: string;
  message?: string;
}

export class InvalidDataException extends BaseException {
  constructor(data: InvalidDataExceptionData, status = 404) {
    super(INVALID_DATA, `Invalid Data in ${data.entity} by id '${data.id}'!`, data, status);
  }
}

//#endregion
