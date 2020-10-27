"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UrlIsNotDescribedInOpenApi = exports.JSONSchemaCannotBeCompiled = exports.MultipleJSONSchemasDefined = exports.JSONSchemaMissing = exports.ResponseDoesNotMatchJSONSchema = exports.OpenApiValidator = void 0;
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
                // console.warn(`[SwaggerValidator] Swagger docs error! Cannot match ${template} to ${url}`)
                return false;
            }
        }).filter(path => path !== null && path !== undefined);
        if (matchingPaths.length === 0) {
            throw new UrlIsNotDescribedInOpenApi(url);
        }
        return Object.fromEntries(matchingPaths.map(pth => [pth, api.paths[pth]]));
    }
    async assertResponse(response) {
        if (!response) {
            throw new Error('response argument is not defined. This is testing framework issue, not real bug');
        }
        const matchingPaths = await this.findMatchingPathInDocs(response.requestUrl);
        const schemas = Object.values(matchingPaths).map((pathObj) => { var _a, _b; return (_b = (_a = pathObj[response.method.toLowerCase()]) === null || _a === void 0 ? void 0 : _a.responses[response.statusCode]) === null || _b === void 0 ? void 0 : _b.schema; }).filter(schema => schema !== undefined && schema !== null);
        // const schema = matchingPaths[response.method.toLowerCase()]?.responses[response.statusCode]?.schema;
        if (schemas.length === 0) {
            throw new JSONSchemaMissing(response);
        }
        if (schemas.length > 1) {
            throw new MultipleJSONSchemasDefined(response);
        }
        const schema = schemas[0];
        const ajv = new ajv_1.default(this.options.ajvOptions);
        let validate;
        try {
            validate = ajv.compile(schema);
        }
        catch (error) {
            throw new JSONSchemaCannotBeCompiled(response);
        }
        const valid = await validate(response.body);
        if (!valid) {
            throw new ResponseDoesNotMatchJSONSchema({
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
class ResponseDoesNotMatchJSONSchema extends Error {
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
    }
}
exports.ResponseDoesNotMatchJSONSchema = ResponseDoesNotMatchJSONSchema;
class JSONSchemaMissing extends Error {
    constructor(response) {
        super(`
        OpenApi spec does not contain body schema found for response: 
        ${response.method} | ${response.requestUrl} | ${response.statusCode}
        Validation cannot be done
        `);
    }
}
exports.JSONSchemaMissing = JSONSchemaMissing;
class MultipleJSONSchemasDefined extends Error {
    constructor(response) {
        super(`
        OpenApi has multiple schemas defined for response: 
        ${response.method} | ${response.requestUrl} | ${response.statusCode}
        Validation cannot be done
        `);
    }
}
exports.MultipleJSONSchemasDefined = MultipleJSONSchemasDefined;
class JSONSchemaCannotBeCompiled extends Error {
    constructor(response) {
        super(`
        JSON schema found for response:
        ${response.method} | ${response.requestUrl} | ${response.statusCode}
        is found, but cannot be used since AJV cannot compile schema. This is OpenApi spec issue.
        Validation cannot be done
        `);
    }
}
exports.JSONSchemaCannotBeCompiled = JSONSchemaCannotBeCompiled;
class UrlIsNotDescribedInOpenApi extends Error {
    constructor(url) {
        super(`
        OpenApi specification does not contain specification for ${url} 
        `);
    }
}
exports.UrlIsNotDescribedInOpenApi = UrlIsNotDescribedInOpenApi;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiT3BlbkFwaVZhbGlkYXRvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy92Mi9PcGVuQXBpVmFsaWRhdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLGlGQUF3RDtBQUN4RCxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUE7QUFFNUMsOENBQXNCO0FBZ0J0QixNQUFNLGNBQWMsR0FBNEI7SUFDNUMsYUFBYSxFQUFFLEVBQUU7SUFDakIsZUFBZSxFQUFFLEVBQUU7SUFDbkIsVUFBVSxFQUFFO1FBQ1IsU0FBUyxFQUFFLElBQUk7UUFDZixPQUFPLEVBQUUsSUFBSTtRQUNiLFlBQVksRUFBRSxJQUFJO0tBQ3JCO0NBQ0osQ0FBQTtBQUVELE1BQWEsZ0JBQWdCO0lBSXpCLFlBQVksT0FBZ0M7UUFGcEMsY0FBUyxHQUE0QixJQUFJLENBQUM7UUFHOUMsSUFBSSxDQUFDLE9BQU8sR0FBRztZQUNYLEdBQUcsY0FBYztZQUNqQixHQUFHLE9BQU87U0FDYixDQUFBO0lBQ0wsQ0FBQztJQUVTLEtBQUssQ0FBQyxXQUFXO1FBQ3ZCLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxJQUFJLEVBQUU7WUFDekIsSUFBSSxDQUFDLFNBQVMsR0FBRyxNQUFNLHdCQUFhLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7U0FDbEY7UUFDRCxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUE7SUFDekIsQ0FBQztJQUVTLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxHQUFXO1FBQzlDLE1BQU0sR0FBRyxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ3JDLE1BQU0sT0FBTyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQTtRQUNyQywwQkFBMEI7UUFDMUIsS0FBSyxNQUFNLFFBQVEsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEdB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