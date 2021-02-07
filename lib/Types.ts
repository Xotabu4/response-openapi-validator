import type * as Ajv from 'ajv';

export interface ResponseValidatorOptions {
    apiPathPrefix?: string,
    openApiSpecPath: string
    ajvOptions?: Ajv.Options
}

export interface ResponseToValidate {
    requestUrl: string,
    statusCode: number,
    method: string,
    body: any
}