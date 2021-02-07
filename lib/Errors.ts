import type * as Ajv from 'ajv';
import { ResponseToValidate } from "./Types"

export class OpenApiValidationError extends Error {
    isOpenApiValidationError: boolean = true
}

export class ResponseDoesNotMatchJSONSchemaError extends OpenApiValidationError {
    constructor(public validationResult: { response: ResponseToValidate, schema: any, validationErrors: Ajv.ErrorObject[] }) {
        super(`
        Response does not match defined Open API JSON schema.

        Response:
        ${validationResult.response.method} | ${validationResult.response.requestUrl} | ${validationResult.response.statusCode}

        Body:
        ${JSON.stringify(validationResult.response.body, null, 2)}

        Validation errors:
        ${JSON.stringify(validationResult.validationErrors, null, 2)}
        `)
        this.name = 'ResponseDoesNotMatchJSONSchemaError'
    }
}

export class JSONSchemaMissingError extends OpenApiValidationError {
    constructor(response: ResponseToValidate) {
        super(`
        OpenApi spec does not contain body schema found for response: 
        ${response.method} | ${response.requestUrl} | ${response.statusCode}
        Validation cannot be done
        `)
        this.name = 'JSONSchemaMissingError'
    }
}

export class MultipleJSONSchemasDefinedError extends OpenApiValidationError {
    constructor(response: ResponseToValidate) {
        super(`
        OpenApi has multiple schemas defined for response: 
        ${response.method} | ${response.requestUrl} | ${response.statusCode}
        Validation cannot be done
        `)
        this.name = 'MultipleJSONSchemasDefinedError'
    }
}

export class JSONSchemaCannotBeCompiledError extends OpenApiValidationError {
    constructor(response: ResponseToValidate, jsonSchemaCompilationError: Error) {
        super(`
        JSON schema for response:
        ${response.method} | ${response.requestUrl} | ${response.statusCode}
        is found, but cannot be used since AJV cannot compile schema. This is OpenApi spec issue.

        Got AJV error ${jsonSchemaCompilationError.name} with message:
        ${jsonSchemaCompilationError.message}

        Validation cannot be done
        `)
        this.name = 'JSONSchemaCannotBeCompiledError'
    }
}

export class UrlIsNotDescribedInOpenApiError extends OpenApiValidationError {
    constructor(url: string) {
        super(`
        OpenApi specification does not contain specification for ${url} 
        `)
        this.name = 'UrlIsNotDescribedInOpenApiError'
    }
}