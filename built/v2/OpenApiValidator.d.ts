import Ajv from 'ajv';
import type { OpenAPI, OpenAPIV2 } from "openapi-types";
export interface OpenApiValidatorOptions {
    apiPathPrefix?: string;
    openApiSpecPath: string;
    ajvOptions?: Ajv.Options;
}
export interface ResponseToValidate {
    requestUrl: string;
    statusCode: number;
    method: string;
    body: any;
}
export declare class OpenApiValidator {
    private readonly options;
    private cachedApi;
    constructor(options: OpenApiValidatorOptions);
    protected loadApiDocs(): Promise<OpenAPI.Document>;
    protected findMatchingPathInDocs(url: string): Promise<OpenAPIV2.PathsObject>;
    assertResponse(response: ResponseToValidate): Promise<void>;
}
export declare class OpenApiValidationError extends Error {
    isOpenApiValidationError: boolean;
}
export declare class ResponseDoesNotMatchJSONSchemaError extends OpenApiValidationError {
    validationResult: {
        response: ResponseToValidate;
        schema: any;
        validationErrors: Ajv.ErrorObject[];
    };
    constructor(validationResult: {
        response: ResponseToValidate;
        schema: any;
        validationErrors: Ajv.ErrorObject[];
    });
}
export declare class JSONSchemaMissingError extends OpenApiValidationError {
    constructor(response: ResponseToValidate);
}
export declare class MultipleJSONSchemasDefinedError extends OpenApiValidationError {
    constructor(response: ResponseToValidate);
}
export declare class JSONSchemaCannotBeCompiledError extends OpenApiValidationError {
    constructor(response: ResponseToValidate, jsonSchemaCompilationError: Error);
}
export declare class UrlIsNotDescribedInOpenApiError extends OpenApiValidationError {
    constructor(url: string);
}
