import { AccessLogFormat, AwsIntegration, IntegrationOptions, IntegrationResponse, IResource, IRestApi, JsonSchema, JsonSchemaType, JsonSchemaVersion, LogGroupLogDestination, MethodLoggingLevel, Model, RequestValidator, Resource, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { AttributeType, ITableV2, Table } from 'aws-cdk-lib/aws-dynamodb';
import { IRole, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Aws, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

/**
 * CDK Stack: API Gateway <-> DynamoDB Integration
 *
 * - Provisions a DynamoDB table to store albums (Artist as partition key, Album as sort key)
 * - Creates a REST API with endpoints to create, list and delete albums
 * - Grants API Gateway an IAM role to call DynamoDB and configures logging and validation
 */
export class ApigatewayDynamodbIntegrationStack extends Stack {
  table: ITableV2;
  restApi: IRestApi;
  integrationErrorResponses: IntegrationResponse[];
  requestValidator: RequestValidator;
  apiGatewayRole: IRole;
  albumResource: IResource;

  /**
   * Stack constructor - orchestrates creation of resources and endpoints
   */
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create underlying resources first
    this.createTable();
    this.createApiGateway();
    this.createAlbumResource();
    this.createPostAlbumEndpoint();
    this.createDeleteAlbumEndpoint();
    this.createGetAllEndopint();
  }

  // Create GET / to scan the DynamoDB table and return all albums
  private createGetAllEndopint() {
    const integrationGetAllAlbumOptions: IntegrationOptions = {
      credentialsRole: this.apiGatewayRole,
      requestTemplates: {
        'application/json': `{ "TableName": "${this.table.tableName}" }`
      },
      integrationResponses: [
        {
          statusCode: '200',
          responseTemplates: {
            'application/json': `[
#foreach($item in $input.path('$.Items'))
{
  "artist": "$item.Artist.S",
  "album": "$item.Album.S",
  #if($item.Tracks && $item.Tracks.L)
  "tracks": [
    #foreach($track in $item.Tracks.L)
    {
      "title": "$track.M.Title.S",
      "length": "$track.M.Length.S"
    }#if($foreach.hasNext),#end
    #end
  ]
  #else
  "tracks": []
  #end
}#if($foreach.hasNext),#end
#end
]`
          }
        },
        ...this.integrationErrorResponses,
      ],
    };

    const scanIntegration = new AwsIntegration({
      service: 'dynamodb',
      region: `${Aws.REGION}`,
      action: 'Scan',
      options: integrationGetAllAlbumOptions
    });

    this.restApi.root.addMethod("GET", scanIntegration, {
      methodResponses: [
        { statusCode: '200' },
        { statusCode: '400' },
        { statusCode: '500' }
      ],
    });
  }

  // Create DELETE /{artist}/{album} to delete an album by key
  private createDeleteAlbumEndpoint() {
    const deleteIntegrationOptions: IntegrationOptions = {
      credentialsRole: this.apiGatewayRole,
      requestTemplates: {
        'application/json': `
{
  "TableName": "${this.table.tableName}",
  "Key": {
    "Artist": { "S": "$util.urlDecode($method.request.path.artist)" },
    "Album": { "S": "$util.urlDecode($method.request.path.album)" }
  },
  "ReturnValues": "ALL_OLD"
}`
      },
      integrationResponses: [
        {
          statusCode: '200',
          responseTemplates: {
            'application/json': `
#set($artist = $input.path('$.Attributes.Artist.S'))
#if($artist && "$artist" != "")
{
  "artist": "$input.path('$.Attributes.Artist.S')",
  "album": "$input.path('$.Attributes.Album.S')"
}
#else
#set($context.responseOverride.status = 404)
{
  "error": "Registro não existe no banco de dados",
  "message": "O artista '$util.urlDecode($method.request.path.artist)' e o álbum '$util.urlDecode($method.request.path.album)' não foram encontrados na tabela"
}
#end`
          }
        },
        ...this.integrationErrorResponses,
      ],
    };

    const deleteIntegration = new AwsIntegration({
      service: 'dynamodb',
      region: `${Aws.REGION}`,
      action: 'DeleteItem',
      options: deleteIntegrationOptions
    });

    const deleteResource = this.restApi.root.addResource('{artist}').addResource('{album}');
    deleteResource.addMethod('DELETE', deleteIntegration, {
      methodResponses: [
        { statusCode: '200' },
        { statusCode: '404' },
        { statusCode: '400' },
        { statusCode: '500' }
      ],
      requestValidator: this.requestValidator,
      requestParameters: {
        'method.request.path.artist': true,
        'method.request.path.album': true,
      },
    });
  }

  // Create POST /album to add a new album; validates payload and puts item into DynamoDB
  private createPostAlbumEndpoint() {
    const postRequestSchema: JsonSchema = {
      title: "PostAlbumSchema",
      type: JsonSchemaType.OBJECT,
      schema: JsonSchemaVersion.DRAFT4,
      properties: {
        artist: { type: JsonSchemaType.STRING },
        album: { type: JsonSchemaType.STRING },
        tracks: {
          type: JsonSchemaType.ARRAY,
          items: {
            type: JsonSchemaType.OBJECT,
            properties: {
              title: { type: JsonSchemaType.STRING },
              lenght: { type: JsonSchemaType.STRING }
            }
          }
        }
      },
      required: ["artist", "album"],
    };

    const postRequestModel: Model = new Model(this, "post-model", {
      restApi: this.restApi,
      contentType: "application/json",
      schema: postRequestSchema,
    });

    const postIntegrationOptions: IntegrationOptions = {
      credentialsRole: this.apiGatewayRole,
      requestTemplates: {
        'application/json': `
        {
          "TableName": "${this.table.tableName}",
          "Item": {
            "Artist": { "S": "$input.path('$.artist')" },
            "Album": { "S": "$input.path('$.album')" }
            #if($input.path('$.tracks') && $input.path('$.tracks').size() > 0)
            ,"Tracks": {
              "L": [
                #foreach($track in $input.path('$.tracks'))
                {
                  "M": {
                    "Title": { "S": "$track.title" },
                    "Length": { "S": "$track.length" }
                  }
                }#if($foreach.hasNext),#end
                #end
              ]
            }
            #end
          }
        }`
      },
      integrationResponses: [
        {
          statusCode: '204',
          responseTemplates: {
            'application/json': '$context.requestId',
          }
        },
        ...this.integrationErrorResponses
      ],
    };

    const postIntegration = new AwsIntegration({
      service: 'dynamodb',
      region: `${Aws.REGION}`,
      action: 'PutItem',
      options: postIntegrationOptions,
    });

    (this.albumResource as Resource).addMethod("POST", postIntegration, {
      methodResponses: [
        { statusCode: '204' },
        { statusCode: '400' },
        { statusCode: '500' }
      ],
      requestModels: { 'application/json': postRequestModel },
      requestValidator: this.requestValidator
    });
  }

  // Add 'album' resource under the API root
  private createAlbumResource() {
    this.albumResource = this.restApi.root.addResource("album");
  }

  // Create API Gateway REST API, logging, IAM role and common integration error responses
  private createApiGateway() {
    const gatewayLogGroup = new LogGroup(this, "apigateway-loggroup", {
      logGroupName: "/aws/api-gateway/apigateway-dynamodb-integration",
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.restApi = new RestApi(this, "rest-apigateway", {
      restApiName: "apigateway-dynamodb-integration",
      deployOptions: {
        tracingEnabled: true,
        loggingLevel: MethodLoggingLevel.INFO,
        accessLogDestination: new LogGroupLogDestination(gatewayLogGroup),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
      },
    });

    this.apiGatewayRole = new Role(this, "apigateway-role", {
      assumedBy: new ServicePrincipal("apigateway.amazonaws.com"),
    });
    this.table.grantFullAccess(this.apiGatewayRole);
    (this.apiGatewayRole as Role).addToPolicy(
      new PolicyStatement({
        actions: [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords"
        ],
        resources: ["*"]
      }),
    );

    this.requestValidator = new RequestValidator(this, "request-validator", {
      requestValidatorName: "apigatewa-dynamodb-validator",
      restApi: this.restApi,
      validateRequestBody: true,
      validateRequestParameters: true,
    });

    // Common integration error responses used by multiple endpoints
    this.integrationErrorResponses = [
      {
        statusCode: "400",
        selectionPattern: "400",
        responseTemplates: {
          'application/json': `{
            "error": "Bad input!"
            }`
        }
      },
      {
        statusCode: "500",
        selectionPattern: "5\\d{2}",
        responseTemplates: {
          'application/json': `{
              "error": "Internal Service Error!"
              }`
        }
      }
    ];
  }

  // Create the DynamoDB table used to store albums
  private createTable() {
    this.table = new Table(this, "dynamodb-table", {
      tableName: "apigateway-dynamodb-integration",
      partitionKey: {
        name: "Artist",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "Album",
        type: AttributeType.STRING,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
