import SwaggerParser from "@apidevtools/swagger-parser";
const URItemplate = require('uri-templates')

import Ajv from 'ajv';
import type { OpenAPI, OpenAPIV2 } from "openapi-types";

export interface OpenApiValidatorOptions {
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

const defaultOptions: OpenApiValidatorOptions = {
    apiPathPrefix: '',
    openApiSpecPath: '', // TODO: throw error when path not provided
    ajvOptions: {
        allErrors: true,
        verbose: true,
        jsonPointers: true,
    }
}

export class OpenApiValidator {
    private readonly options: OpenApiValidatorOptions;
    private cachedApi: OpenAPI.Document | null = null;

    constructor(options: OpenApiValidatorOptions) {
        this.options = {
            ...defaultOptions,
            ...options
        }
    }

    protected async loadApiDocs(): Promise<OpenAPI.Document> {
        if (this.cachedApi === null) {
            this.cachedApi = await SwaggerParser.dereference(this.options.openApiSpecPath);
        }
        return this.cachedApi
    }

    protected async findMatchingPathInDocs(url: string): Promise<OpenAPIV2.PathsObject> {
        const api = await this.loadApiDocs();
        const urlPath = new URL(url).pathname
        // Direct match, best case
        for (const template of Object.keys(api.paths)) {
            if (`${this.options.apiPathPrefix}${template}` === urlPath) {
                return { [template]: api.paths[template] }
            }
        }
        const matchingPaths = Object.keys(api.paths).filter(template => {
            try {
                const templatePath = `${this.options.apiPathPrefix}${template}`
                // Number of path sections is not matches
                if (templatePath.split('/').length !== urlPath.split('/').length) {
                    return false
                }
                return URItemplate(templatePath).test(urlPath)
            } catch (err) {
                return false
            }
        }).filter(path => path !== null && path !== undefined)
        if (matchingPaths.length === 0) {
            throw new UrlIsNotDescribedInOpenApiError(url)
        }
        return Object.fromEntries(matchingPaths.map(pth => [pth, api.paths[pth]]))
    }

    public async assertResponse(response: ResponseToValidate): Promise<void> {
        if (!response) {
            throw new Error('response argument is not defined. This is testing framework issue, not real bug')
        }
        const matchingPaths = await this.findMatchingPathInDocs(response.requestUrl)
        const schemas = Object.values<OpenAPIV2.PathsObject>(matchingPaths)
            .map(pathObj => pathObj[response.method.toLowerCase()]?.responses[response.statusCode]?.schema)
            .filter(schema => schema !== undefined && schema !== null)

        if (schemas.length === 0) {
            throw new JSONSchemaMissingError(response)
        }
        if (schemas.length > 1) {
            throw new MultipleJSONSchemasDefinedError(response)
        }
        const schema = schemas[0];

        const ajv = new Ajv(this.options.ajvOptions);
        let validate
        try {
            validate = ajv.compile(schema);
        } catch (error) {
            throw new JSONSchemaCannotBeCompiledError(response);
        }

        const valid = await validate(response.body);
        if (!valid) {
            throw new ResponseDoesNotMatchJSONSchemaError({
                response: {
                    method: response.method,
                    requestUrl: response.requestUrl,
                    statusCode: response.statusCode,
                    body: response.body,
                },
                schema: schema,
                validationErrors: validate.errors as Ajv.ErrorObject[]
            })
        }
    }
}

export class ResponseDoesNotMatchJSONSchemaError extends Error {
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

export class JSONSchemaMissingError extends Error {
    constructor(response: ResponseToValidate) {
        super(`
        OpenApi spec does not contain body schema found for response: 
        ${response.method} | ${response.requestUrl} | ${response.statusCode}
        Validation cannot be done
        `)
        this.name = 'JSONSchemaMissingError'
    }
}

export class MultipleJSONSchemasDefinedError extends Error {
    constructor(response: ResponseToValidate) {
        super(`
        OpenApi has multiple schemas defined for response: 
        ${response.method} | ${response.requestUrl} | ${response.statusCode}
        Validation cannot be done
        `)
        this.name = 'MultipleJSONSchemasDefinedError'
    }
}

export class JSONSchemaCannotBeCompiledError extends Error {
    constructor(response: ResponseToValidate) {
        super(`
        JSON schema found for response:
        ${response.method} | ${response.requestUrl} | ${response.statusCode}
        is found, but cannot be used since AJV cannot compile schema. This is OpenApi spec issue.
        Validation cannot be done
        `)
        this.name = 'JSONSchemaCannotBeCompiledError'
    }
}

export class UrlIsNotDescribedInOpenApiError extends Error {
    constructor(url: string) {
        super(`
        OpenApi specification does not contain specification for ${url} 
        `)
        this.name = 'UrlIsNotDescribedInOpenApiError'
    }
}