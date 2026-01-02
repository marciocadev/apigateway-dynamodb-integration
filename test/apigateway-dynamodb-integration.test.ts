import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ApigatewayDynamodbIntegrationStack } from '../lib/apigateway-dynamodb-integration-stack';

// Unit tests for the CDK stack resources

test('DynamoDB Table Created', () => {
  const app = new cdk.App();
  const stack = new ApigatewayDynamodbIntegrationStack(app, 'TestStack');

  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::DynamoDB::Table', {
    TableName: 'apigateway-dynamodb-integration'
  });
});

test('API Gateway RestApi Created', () => {
  const app = new cdk.App();
  const stack = new ApigatewayDynamodbIntegrationStack(app, 'TestStack');

  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::ApiGateway::RestApi', {
    Name: 'apigateway-dynamodb-integration'
  });
});

test('CloudWatch Log Group Created for API Gateway', () => {
  const app = new cdk.App();
  const stack = new ApigatewayDynamodbIntegrationStack(app, 'TestStack');

  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::Logs::LogGroup', {
    LogGroupName: '/aws/api-gateway/apigateway-dynamodb-integration'
  });
});

test('Request Validator configured', () => {
  const app = new cdk.App();
  const stack = new ApigatewayDynamodbIntegrationStack(app, 'TestStack');

  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::ApiGateway::RequestValidator', {
    ValidateRequestBody: true,
    ValidateRequestParameters: true
  });
});

test('Model for POST /album exists', () => {
  const app = new cdk.App();
  const stack = new ApigatewayDynamodbIntegrationStack(app, 'TestStack');

  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::ApiGateway::Model', {
    ContentType: 'application/json'
  });
});

test('HTTP Methods: GET, POST and DELETE exist', () => {
  const app = new cdk.App();
  const stack = new ApigatewayDynamodbIntegrationStack(app, 'TestStack');

  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::ApiGateway::Method', {
    HttpMethod: 'POST'
  });

  template.hasResourceProperties('AWS::ApiGateway::Method', {
    HttpMethod: 'DELETE'
  });

  template.hasResourceProperties('AWS::ApiGateway::Method', {
    HttpMethod: 'GET'
  });
});

