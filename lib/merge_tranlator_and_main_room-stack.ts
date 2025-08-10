import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export class MergeTranlatorAndMainRoomStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Import existing S3 bucket
    const mergedVideosBucket = s3.Bucket.fromBucketName(
      this,
      'ExistingMergedVideosBucket',
      'recording.htface'
    );

    // IAM role for MediaConvert (create first)
    const mediaConvertRole = new iam.Role(this, 'MediaConvertRole', {
      assumedBy: new iam.ServicePrincipal('mediaconvert.amazonaws.com'),
      // Create custom policy since AWSMediaConvertServiceRole doesn't exist
      inlinePolicies: {
        MediaConvertPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:ListBucket',
                's3:DeleteObject',
                's3:GetBucketLocation'
              ],
              resources: [
                'arn:aws:s3:::recording.htface/*',
                'arn:aws:s3:::recording.htface'
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents'
              ],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    // IAM role for Lambda function
    const lambdaRole = new iam.Role(this, 'VideoMergeLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Add MediaConvert permissions
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'mediaconvert:CreateJob',
        'mediaconvert:GetJob',
        'mediaconvert:ListJobs',
        'mediaconvert:DescribeEndpoints',
        'mediaconvert:GetJobTemplate',
        'mediaconvert:ListJobTemplates',
      ],
      resources: ['*'],
    }));

    // Add S3 permissions for reading input videos and writing merged output
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:ListBucket',
      ],
      resources: [
        'arn:aws:s3:::recording.htface/*',
        'arn:aws:s3:::recording.htface',
      ],
    }));

    // Add ability to pass MediaConvert role
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'iam:PassRole',
      ],
      resources: [mediaConvertRole.roleArn],
    }));

    // Add S3 permissions for MediaConvert to access existing bucket
    mediaConvertRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:ListBucket',
      ],
      resources: [
        'arn:aws:s3:::recording.htface/*',
        'arn:aws:s3:::recording.htface',
      ],
    }));

    // Lambda function for video merging
    const videoMergeLambda = new lambda.Function(this, 'VideoMergeLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'video-merge.handler',
      code: lambda.Code.fromAsset('lambda'),
      role: lambdaRole,
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        MEDIACONVERT_ENDPOINT: 'https://mediaconvert.us-east-1.amazonaws.com',
        MEDIACONVERT_ROLE_ARN: mediaConvertRole.roleArn,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Output the bucket name and Lambda function name
    new cdk.CfnOutput(this, 'MergedVideosBucketName', {
      value: mergedVideosBucket.bucketName,
      description: 'S3 bucket for merged videos',
    });

    new cdk.CfnOutput(this, 'VideoMergeLambdaName', {
      value: videoMergeLambda.functionName,
      description: 'Lambda function for video merging',
    });

    new cdk.CfnOutput(this, 'VideoMergeLambdaArn', {
      value: videoMergeLambda.functionArn,
      description: 'Lambda function ARN for video merging',
    });
  }
}
