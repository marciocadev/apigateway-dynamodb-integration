# API Gateway ↔ DynamoDB Integration 🚀

**apigateway-dynamodb-integration** is a small AWS CDK (TypeScript) project that provisions an API Gateway REST API integrated directly with DynamoDB (no Lambda). It demonstrates how to: create a DynamoDB table, configure API Gateway with VTL request/response templates and IAM role credentials, validate payloads, enable logging and tracing, and provide simple endpoints to create, list and delete albums.

---

## Table of contents

- **Overview**
- **Architecture & Resources**
- **API Endpoints**
- **Local development & tests**
- **Deployment**
- **Project structure**
- **Troubleshooting & notes**

---

## Overview ✨

This project creates a DynamoDB table named `apigateway-dynamodb-integration` (partition key: `Artist`, sort key: `Album`) and a REST API that:

- POST /album — inserts an album item
- GET / — scans the table and returns all album items
- DELETE /{artist}/{album} — deletes an album by key

API Gateway uses an IAM role to directly call DynamoDB actions (PutItem, Scan, DeleteItem) with VTL request templates and integration response templates for success and error cases.

---

## Architecture & Resources 🔧

- DynamoDB Table: `apigateway-dynamodb-integration`
  - Partition key: `Artist` (String)
  - Sort key: `Album` (String)
  - Removal policy: `DESTROY` (for tutorial/demo use)

- API Gateway
  - Logging enabled (CloudWatch Log Group `/aws/api-gateway/apigateway-dynamodb-integration`)
  - Tracing enabled (X-Ray)
  - Request validation with a Request Validator and a JSON Schema Model for POST /album

- IAM Role for API Gateway
  - Grants full access to the DynamoDB table and permission to send X-Ray telemetry

- Error handling
  - Common integration error responses for 400 and 500 codes are defined and used across endpoints

---

## API Endpoints 📡

Note: The actual API base URL is created by CDK and will look like `https://{restId}.execute-api.{region}.amazonaws.com/prod` after deployment. Use the CDK output or the CloudFormation console to find the URL.

### POST /album
- Purpose: Add a new album item to the table
- Request body (application/json):

```json
{
  "artist": "Pink Floyd",
  "album": "The Dark Side of the Moon",
  "tracks": [
    { "title": "Speak to Me", "length": "1:07" },
    { "title": "Breathe", "length": "2:49" }
  ]
}
```

- Responses:
  - 204 No Content — success (returns request id)
  - 400 — bad input
  - 500 — internal error

- Example using the `payloads/post_album_1.rest` (or `curl`):

```bash
curl -X POST "$API_URL/album" \
  -H "Content-Type: application/json" \
  -d @payloads/post_album_1.rest
```

### GET /
- Purpose: Scan the table and return all albums
- Response: 200 OK with JSON array of albums (artist, album, tracks)
- Example:

```bash
curl "$API_URL/"
```

### DELETE /{artist}/{album}
- Purpose: Delete an album by Artist and Album
- Path params: `artist`, `album` (required)
- Responses:
  - 200 OK — deleted item returned when found
  - 404 — item not found
  - 400 / 500 — error

- Example:

```bash
curl -X DELETE "$API_URL/Pink%20Floyd/The%20Dark%20Side%20of%20the%20Moon"
```

---

## Local development & tests 🧪

Prerequisites:
- Node.js (compatible with the `typescript` version in `package.json`)
- npm
- AWS CLI configured with credentials for deployment (if you plan to deploy)

Commands:

- Install dependencies:

```bash
npm install
```

- Compile TypeScript:

```bash
npm run build
```

- Run tests (Jest):

```bash
npm test
```

Tests are located in `test/` and focus on the CDK construct behavior.

---

## Deployment 🚀

To deploy to your AWS account/region (you need proper IAM rights to create resources):

1. (Optional) Bootstrap the environment if not already done:

```bash
cdk bootstrap
```

2. Synthesize and deploy:

```bash
npm run build
cdk deploy
```

CDK will print the API endpoint URL in the outputs after a successful deploy.

Security note: This tutorial uses `RemovalPolicy.DESTROY` for convenience; do not use this in production unless you understand the consequences.

---

## Project structure 📁

- `bin/` - CDK app entry
- `lib/` - CDK stack (`apigateway-dynamodb-integration-stack.ts`)
- `payloads/` - sample request payloads and rest clients
- `test/` - tests for the CDK stack
- `package.json`, `tsconfig.json`, `jest.config.js` - build & test configuration

---

## Troubleshooting & tips ⚠️

- If `cdk deploy` fails with permission errors, ensure your AWS credentials have IAM, CloudFormation, API Gateway, DynamoDB, CloudWatch, and X-Ray permissions.
- If you see VTL template errors in API Gateway responses, check the integration response selection patterns and the request templates in `lib/apigateway-dynamodb-integration-stack.ts`.
- To inspect logs: open CloudWatch Logs and look for the log group `/aws/api-gateway/apigateway-dynamodb-integration`.

---

## Contributing

Contributions are welcome — open an issue or a pull request for improvements or bug fixes.

---

## License

This project is licensed under the terms in `LICENSE.txt`.
