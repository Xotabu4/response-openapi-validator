"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UrlIsNotDescribedInOpenApiError = exports.JSONSchemaCannotBeCompiledError = exports.MultipleJSONSchemasDefinedError = exports.JSONSchemaMissingError = exports.ResponseDoesNotMatchJSONSchemaError = exports.OpenApiValidationError = exports.OpenApiValidator = void 0;
const swagger_parser_1 = __importDefault(require("@apidevtools/swagger-parser"));
const URItemplate = require('uri-templates');
const ajv_1 = __importDefault(require("ajv"));
const defaultOptions = {
    apiPathPrefix: '',
    openApiSpecPath: '',
    ajvOptions: {
        allErrors: true,
        verbose: true,
        jsonPointers: true,
    }
};
class OpenApiValidator {
    constructor(options) {
        this.cachedApi = null;
        this.options = {
            ...defaultOptions,
            ...options
        };
    }
    async loadApiDocs() {
        if (this.cachedApi === null) {
            this.cachedApi = await swagger_parser_1.default.dereference(this.options.openApiSpecPath);
        }
        return this.cachedApi;
    }
    async findMatchingPathInDocs(url) {
        const api = await this.loadApiDocs();
        const urlPath = new URL(url).pathname;
        // Direct match, best case
        for (const template of Object.keys(api.paths)) {
            if (`${this.options.apiPathPrefix}${template}` === urlPath) {
                return { [template]: api.paths[template] };
            }
        }
        const matchingPaths = Object.keys(api.paths).filter(template => {
            try {
                const templatePath = `${this.options.apiPathPrefix}${template}`;
                // Number of path sections is not matches
                if (templatePath.split('/').length !== urlPath.split('/').length) {
                    return false;
                }
                return URItemplate(templatePath).test(urlPath);
            }
            catch (err) {
                return false;
            }
        }).filter(path => path !== null && path !== undefined);
        if (matchingPaths.length === 0) {
            throw new UrlIsNotDescribedInOpenApiError(url);
        }
        return Object.fromEntries(matchingPaths.map(pth => [pth, api.paths[pth]]));
    }
    async assertResponse(response) {
        if (!response) {
            throw new Error('response argument is not defined. This is testing framework issue, not real bug');
        }
        const matchingPaths = await this.findMatchingPathInDocs(response.requestUrl);
        const schemas = Object.values(matchingPaths)
            .map(pathObj => { var _a, _b; return (_b = (_a = pathObj[response.method.toLowerCase()]) === null || _a === void 0 ? void 0 : _a.responses[response.statusCode]) === null || _b === void 0 ? void 0 : _b.schema; })
            .filter(schema => schema !== undefined && schema !== null);
        if (schemas.length === 0) {
            throw new JSONSchemaMissingError(response);
        }
        if (schemas.length > 1) {
            throw new MultipleJSONSchemasDefinedError(response);
        }
        const schema = schemas[0];
        const ajv = new ajv_1.default(this.options.ajvOptions);
        let validate;
        try {
            validate = ajv.compile(schema);
        }
        catch (jsonSchemaCompilationError) {
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
            });
        }
    }
}
exports.OpenApiValidator = OpenApiValidator;
class OpenApiValidationError extends Error {
    constructor() {
        super(...arguments);
        this.isOpenApiValidationError = true;
    }
}
exports.OpenApiValidationError = OpenApiValidationError;
class ResponseDoesNotMatchJSONSchemaError extends OpenApiValidationError {
    constructor(validationResult) {
        super(`
        Response does not match defined Open API JSON schema.

        Response:
        ${validationResult.response.method} | ${validationResult.response.requestUrl} | ${validationResult.response.statusCode}

        Body:
        ${JSON.stringify(validationResult.response.body, null, 2)}

        Validation errors:
        ${JSON.stringify(validationResult.validationErrors, null, 2)}
        `);
        this.validationResult = validationResult;
        this.name = 'ResponseDoesNotMatchJSONSchemaError';
    }
}
exports.ResponseDoesNotMatchJSONSchemaError = ResponseDoesNotMatchJSONSchemaError;
class JSONSchemaMissingError extends OpenApiValidationError {
    constructor(response) {
        super(`
        OpenApi spec does not contain body schema found for response: 
        ${response.method} | ${response.requestUrl} | ${response.statusCode}
        Validation cannot be done
        `);
        this.name = 'JSONSchemaMissingError';
    }
}
exports.JSONSchemaMissingError = JSONSchemaMissingError;
class MultipleJSONSchemasDefinedError extends OpenApiValidationError {
    constructor(response) {
        super(`
        OpenApi has multiple schemas defined for response: 
        ${response.method} | ${response.requestUrl} | ${response.statusCode}
        Validation cannot be done
        `);
        this.name = 'MultipleJSONSchemasDefinedError';
    }
}
exports.MultipleJSONSchemasDefinedError = MultipleJSONSchemasDefinedError;
class JSONSchemaCannotBeCompiledError extends OpenApiValidationError {
    constructor(response, jsonSchemaCompilationError) {
        super(`
        JSON schema found for response:
        ${response.method} | ${response.requestUrl} | ${response.statusCode}
        is found, but cannot be used since AJV cannot compile schema. This is OpenApi spec issue.

        Got AJV error ${jsonSchemaCompilationError.name} with message:
        ${jsonSchemaCompilationError.message}

        Validation cannot be done
        `);
        this.name = 'JSONSchemaCannotBeCompiledError';
    }
}
exports.JSONSchemaCannotBeCompiledError = JSONSchemaCannotBeCompiledError;
class UrlIsNotDescribedInOpenApiError extends OpenApiValidationError {
    constructor(url) {
        super(`
        OpenApi specification does not contain specification for ${url} 
        `);
        this.name = 'UrlIsNotDescribedInOpenApiError';
    }
}
exports.UrlIsNotDescribedInOpenApiError = UrlIsNotDescribedInOpenApiError;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiT3BlbkFwaVZhbGlkYXRvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy92Mi9PcGVuQXBpVmFsaWRhdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLGlGQUF3RDtBQUN4RCxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUE7QUFFNUMsOENBQXNCO0FBZ0J0QixNQUFNLGNBQWMsR0FBNEI7SUFDNUMsYUFBYSxFQUFFLEVBQUU7SUFDakIsZUFBZSxFQUFFLEVBQUU7SUFDbkIsVUFBVSxFQUFFO1FBQ1IsU0FBUyxFQUFFLElBQUk7UUFDZixPQUFPLEVBQUUsSUFBSTtRQUNiLFlBQVksRUFBRSxJQUFJO0tBQ3JCO0NBQ0osQ0FBQTtBQUVELE1BQWEsZ0JBQWdCO0lBSXpCLFlBQVksT0FBZ0M7UUFGcEMsY0FBUyxHQUE0QixJQUFJLENBQUM7UUFHOUMsSUFBSSxDQUFDLE9BQU8sR0FBRztZQUNYLEdBQUcsY0FBYztZQUNqQixHQUFHLE9BQU87U0FDYixDQUFBO0lBQ0wsQ0FBQztJQUVTLEtBQUssQ0FBQyxXQUFXO1FBQ3ZCLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxJQUFJLEVBQUU7WUFDekIsSUFBSSxDQUFDLFNBQVMsR0FBRyxNQUFNLHdCQUFhLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7U0FDbEY7UUFDRCxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUE7SUFDekIsQ0FBQztJQUVTLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxHQUFXO1FBQzlDLE1BQU0sR0FBRyxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ3JDLE1BQU0sT0FBTyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQTtRQUNyQywwQkFBMEI7UUFDMUIsS0FBSyxNQUFNLFFBQVEsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEdB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