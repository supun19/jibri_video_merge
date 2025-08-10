import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export interface AutomatedVideoProcessorStackProps extends cdk.StackProps {
  videoMergeLambda: lambda.Function;
}

export class AutomatedVideoProcessorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AutomatedVideoProcessorStackProps) {
    super(scope, id, props);

    // Get reference to existing VideoMergeEcsStack Lambda function
    const videoMergeLambda = props.videoMergeLambda;

    // Use default VPC (free, already has internet access)
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVPC', {
      isDefault: true,
    });

    // Create DynamoDB table for tracking file uploads
    const fileTrackingTable = new dynamodb.Table(this, 'FileTrackingTable', {
      tableName: 'video-file-tracking',
      partitionKey: { name: 'roomName', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl', // Auto-delete old records after 24 hours
    });

    // Add GSI for file type queries
    fileTrackingTable.addGlobalSecondaryIndex({
      indexName: 'fileTypeIndex',
      partitionKey: { name: 'fileType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
    });

    // Create Lambda function for automated file processing
    const fileProcessorLambda = new lambda.Function(this, 'FileProcessorLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'file-processor.handler',
      code: lambda.Code.fromAsset('lambda'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        DYNAMODB_TABLE: fileTrackingTable.tableName,
        S3_BUCKET: 'recording.htface',
        TIME_WINDOW_MINUTES: '15', // 15-minute time window for matching files
        VIDEO_MERGE_LAMBDA_NAME: videoMergeLambda.functionName, // Reference from existing stack output
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant DynamoDB permissions to Lambda
    fileTrackingTable.grantReadWriteData(fileProcessorLambda);

    // Grant Lambda invoke permissions to call the existing VideoMergeEcsStack Lambda
    fileProcessorLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'lambda:InvokeFunction',
      ],
      resources: ['*'], // You can restrict this to specific Lambda ARN if needed
    }));

    // Grant S3 permissions to Lambda
    fileProcessorLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:ListBucket',
      ],
      resources: [
        'arn:aws:s3:::recording.htface/*',
        'arn:aws:s3:::recording.htface',
      ],
    }));

    // Create S3 bucket reference (existing bucket)
    const s3Bucket = s3.Bucket.fromBucketName(this, 'ExistingBucket', 'recording.htface');

    // Add S3 event notifications for main-room and translator folders
    s3Bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(fileProcessorLambda),
      { prefix: 'main-room/' }
    );

    s3Bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(fileProcessorLambda),
      { prefix: 'translater/' }
    );

    // Outputs
    new cdk.CfnOutput(this, 'FileProcessorLambdaName', {
      value: fileProcessorLambda.functionName,
      description: 'Automated File Processor Lambda Function Name',
    });

    new cdk.CfnOutput(this, 'VpcId', {
      value: vpc.vpcId,
      description: 'Default VPC ID',
    });

    new cdk.CfnOutput(this, 'DynamoDBTableName', {
      value: fileTrackingTable.tableName,
      description: 'DynamoDB Table for File Tracking',
    });

    new cdk.CfnOutput(this, 'S3BucketName', {
      value: 'recording.htface',
      description: 'S3 Bucket for Video Files',
    });
  }
} 