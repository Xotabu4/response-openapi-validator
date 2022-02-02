import * as SwaggerParser from "@apidevtools/swagger-parser";
import * as URItemplate from 'uri-templates'
import Ajv from 'ajv/dist/ajv';
import addFormats from 'ajv-formats'
import type { OpenAPI, OpenAPIV2, OpenAPIV3 } from "openapi-types";

import {
    UrlIsNotDescribedInOpenApiError, JSONSchemaMissingError, MultipleJSONSchemasDefinedError,
    JSONSchemaCannotBeCompiledError, ResponseDoesNotMatchJSONSchemaError
} from "./Errors";
import { ResponseValidatorOptions, ResponseToValidate } from "./Types";


const defaultOptions: ResponseValidatorOptions = {
    apiPathPrefix: '',
    openApiSpecPath: '', // TODO: throw error when path not provided
    ajvOptions: {
        allErrors: true,
        verbose: true,
        strict: 'log'
    }
}

export class ResponseValidator {
    private readonly options: ResponseValidatorOptions;
    private cachedApi: OpenAPI.Document | null = null;

    constructor(options: ResponseValidatorOptions) {
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
        const findSchemaInPath = function (path) {
            //Early return
            if (path.schema !== undefined) {
                return path.schema
            }
            let result, property
            for (property in path) {
                if (path.hasOwnProperty(property) &&typeof path[property] === 'object') {
                    result = findSchemaInPath(path[property])
                    if (result) {
                        return result
                    }
                }
            }
            return result
        }
        const matchingPaths = await this.findMatchingPathInDocs(response.requestUrl)
        const schemas = Object.values<OpenAPIV2.PathsObject>(matchingPaths)
            .map(pathObj => findSchemaInPath(pathObj[response.method.toLowerCase()]?.responses[response.statusCode]))
            .filter(schema => schema !== undefined && schema !== null)

        if (schemas.length === 0) {
            throw new JSONSchemaMissingError(response)
        }
        if (schemas.length > 1) {
            throw new MultipleJSONSchemasDefinedError(response)
        }
        const schema = schemas[0];

        const ajv = new Ajv(this.options.ajvOptions);
        addFormats(ajv)
        let validate
        try {
            validate = ajv.compile(schema);
        } catch (jsonSchemaCompilationError) {
            throw new JSONSchemaCannotBeCompiledError(response, jsonSchemaCompilationError);
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
                validationErrors: validate.errors
            })
        }
    }
}
