import * as OpenAPIParser from '@readme/openapi-parser';
import URItemplate from 'uri-templates';
import Ajv from "ajv/dist/core";
import addFormats from 'ajv-formats'
import type { OpenAPI, OpenAPIV2, OpenAPIV3 } from "openapi-types";

import {
    UrlIsNotDescribedInOpenApiError, JSONSchemaMissingError, MultipleJSONSchemasDefinedError,
    JSONSchemaCannotBeCompiledError, ResponseDoesNotMatchJSONSchemaError
} from "./Errors";
import { ResponseToValidate, ResponseValidatorOptions } from "./Types";



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
            this.cachedApi = await (OpenAPIParser as any).dereference(this.options.openApiSpecPath);
        }
        return this.cachedApi;
    }

    protected async findMatchingPathInDocs(url: string): Promise<Partial<OpenAPIV3.PathsObject>> {
        const api = await this.loadApiDocs();
        const urlPath = new URL(url).pathname;
    
        for (const template of Object.keys(api.paths)) {
            if (`${this.options.apiPathPrefix}${template}` === urlPath) {
                return { [template]: api.paths[template] as OpenAPIV3.PathItemObject };
            }
        }
    
        const matchingPaths = Object.keys(api.paths).filter(template => {
            try {
                const templatePath = `${this.options.apiPathPrefix}${template}`;
                if (templatePath.split('/').length !== urlPath.split('/').length) {
                    return false;
                }
                return (URItemplate(templatePath) as any).test(urlPath);
            } catch (err) {
                return false;
            }
        }).filter(Boolean);
    
        if (matchingPaths.length === 0) {
            throw new UrlIsNotDescribedInOpenApiError(url);
        }
    
        return Object.fromEntries(
            matchingPaths.map(pth => [pth, api.paths[pth] as OpenAPIV3.PathItemObject])
        ) as Partial<OpenAPIV3.PathsObject>;
    }

    public async assertResponse(response: ResponseToValidate): Promise<void> {
        if (!response) {
            throw new Error('response argument is not defined. This is testing framework issue, not real bug')
        }
        const findSchemaInPath = function (path) {
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
        const matchingPaths = await this.findMatchingPathInDocs(response.requestUrl);
        const schemas = Object.values(matchingPaths)
        .flatMap(pathObj => {
            const method = response.method.toLowerCase() as keyof OpenAPIV3.PathItemObject;
            const methodObj = pathObj[method] as OpenAPIV3.OperationObject | undefined;
            const responseObj = methodObj?.responses?.[response.statusCode];
            return responseObj ? [findSchemaInPath(responseObj)] : [];
        })
        .filter((schema): schema is NonNullable<ReturnType<typeof findSchemaInPath>> => 
            schema !== undefined && schema !== null
        );

        if (schemas.length === 0) {
            throw new JSONSchemaMissingError(response)
        }
        if (schemas.length > 1) {
            throw new MultipleJSONSchemasDefinedError(response)
        }
        const schema = schemas[0];

        const ajv = new Ajv({
            ...this.options.ajvOptions,
            strict: false
          });
          (addFormats as any)(ajv);
          for (const key in this.options.ajvOptions.formats) {
            ajv.addFormat(key, this.options.ajvOptions.formats[key])
        }
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
