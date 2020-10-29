# openapi-request-validator

-   TODO: Add open api v3 support

-   TODO: Add unit tests

```typescript
const validator = new OpenApiValidator({
    openApiSpecPath: "./.temp/open_api_docs.json",
});

const response = await got("http://someserver.com/api/something");

await validator.assertResponse({
    method: response.request?.options?.method,
    requestUrl: response?.request?.requestUrl,
    statusCode: response?.statusCode,
    body: response.body,
});
```

### Option: ajvOptions

AJV is used to match found JSON schema against body.
You can define AJV options by passing param:

```typescript
const validator = new OpenApiValidator({
    openApiSpecPath: "./.temp/open_api_docs.json",
    // You can see all AJV options here
    // https://github.com/ajv-validator/ajv#options
    ajvOptions: {
        // I recommend to keep allErrors, verbose, and jsonPointers options enabled
        allErrors: true,
        verbose: true,
        jsonPointers: true,

        // Define additional JSON schema formats, if needed
        formats: {
            double: "[+-]?\\d*\\.?\\d+",
            int32: /^(-?\d{1,9}|-?1\d{9}|-?20\d{8}|-?21[0-3]\d{7}|-?214[0-6]\d{6}|-?2147[0-3]\d{5}|-?21474[0-7]\d{4}|-?214748[012]\d{4}|-?2147483[0-5]\d{3}|-?21474836[0-3]\d{2}|214748364[0-7]|-214748364[0-8])$/,
            int64: /^\d+$/,
        },
    },
});
```

### Option: apiPathPrefix

Sometimes API has prefix part, which is not defined in docs.

Real path:

```
/core/user/create
```

Path defined in docs:

```
/user/create
```

You can specify such prefix in options:

```typescript
const validator = new OpenApiValidator({
    apiPathPrefix: '/core'
    openApiSpecPath: "./.temp/open_api_docs.json",
});

await validator.assertResponse({
    method: response.request?.options?.method,
    requestUrl: response?.request?.requestUrl,
    statusCode: response?.statusCode,
    body: response.body,
});
```
