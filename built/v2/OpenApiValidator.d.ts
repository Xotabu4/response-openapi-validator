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
export declare class ResponseDoesNotMatchJSONSchema extends Error {
    validationResult: {
        response: ResponseToValidate;
        schema: any;
        validationErrors: any;
    };
    constructor(validationResult: {
        response: ResponseToValidate;
        schema: any;
        validationErrors: any;
    });
}
export declare class JSONSchemaMissing extends Error {
    constructor(response: ResponseToValidate);
}
export declare class MultipleJSONSchemasDefined extends Error {
    constructor(response: ResponseToValidate);
}
export declare class JSONSchemaCannotBeCompiled extends Error {
    constructor(response: ResponseToValidate);
}
export declare class UrlIsNotDescribedInOpenApi extends Error {
    constructor(url: string);
}
