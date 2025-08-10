import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

export class VideoMergeEcsStack extends cdk.Stack {
  public readonly videoMergeLambda: lambda.Function;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Import existing S3 bucket
    const mergedVideosBucket = s3.Bucket.fromBucketName(
      this,
      'ExistingMergedVideosBucket',
      'recording.htface'
    );

    // Use default VPC (free, already has internet access)
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVPC', {
      isDefault: true,
    });

    // Create ECR repository for our video merge image
    const ecrRepository = new ecr.Repository(this, 'VideoMergeRepository', {
      repositoryName: 'video-merge',
      imageScanOnPush: true,
    });

    // IAM role for ECS tasks
    const ecsTaskRole = new iam.Role(this, 'EcsTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // Add S3 permissions for ECS tasks
    ecsTaskRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:ListBucket',
        's3:DeleteObject',
      ],
      resources: [
        'arn:aws:s3:::recording.htface/*',
        'arn:aws:s3:::recording.htface',
      ],
    }));

    // Create ECS cluster
    const cluster = new ecs.Cluster(this, 'VideoMergeCluster', {
      vpc,
      clusterName: 'video-merge-cluster',
    });

    // Create ECS task definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'VideoMergeTaskDef', {
      memoryLimitMiB: 4096, // 4GB memory
      cpu: 2048, // 2 vCPU
      taskRole: ecsTaskRole,
      executionRole: ecsTaskRole,
    });

    // Add container to task definition
    const videoMergeContainer = taskDefinition.addContainer('VideoMergeContainer', {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepository, 'latest'),
      memoryLimitMiB: 4096,
      cpu: 2048,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'video-merge',
        logRetention: logs.RetentionDays.ONE_WEEK,
      }),
      environment: {
        S3_BUCKET: 'recording.htface',
        AWS_REGION: this.region,
      },
    });

    // Create ECS service using Fargate
    const videoMergeService = new ecs.FargateService(this, 'VideoMergeService', {
      cluster,
      taskDefinition,
      desiredCount: 0, // Start with 0, scale up based on demand
      serviceName: 'video-merge-service',
    });

    // Create Lambda function to trigger ECS tasks
    this.videoMergeLambda = new lambda.Function(this, 'VideoMergeLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'video-merge-ecs.handler',
      code: lambda.Code.fromAsset('lambda'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      role: new iam.Role(this, 'VideoMergeLambdaRole', {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        ],
        inlinePolicies: {
          EcsPolicy: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                  'ecs:RunTask',
                  'ecs:StopTask',
                  'ecs:DescribeTasks',
                  'ecs:ListTasks',
                ],
                resources: ['*'],
              }),
              new iam.PolicyStatement({
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
              }),
              new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                  'iam:PassRole',
                ],
                resources: [ecsTaskRole.roleArn],
              }),
            ],
          }),
        },
      }),
      environment: {
        ECS_CLUSTER_NAME: cluster.clusterName,
        ECS_TASK_DEFINITION_ARN: taskDefinition.taskDefinitionArn,
        S3_BUCKET: 'recording.htface',
        VPC_SUBNET_IDS: vpc.publicSubnets.map(subnet => subnet.subnetId).join(','),
        VPC_SECURITY_GROUP_IDS: '',
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant Lambda permission to use the task execution role
    ecsTaskRole.grantPassRole(this.videoMergeLambda.role!);

    // Outputs
    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: ecrRepository.repositoryUri,
      description: 'ECR repository URI for video merge image',
    });

    new cdk.CfnOutput(this, 'EcsClusterName', {
      value: cluster.clusterName,
      description: 'ECS cluster name',
    });

    new cdk.CfnOutput(this, 'EcsServiceName', {
      value: videoMergeService.serviceName,
      description: 'ECS service name',
    });

    new cdk.CfnOutput(this, 'EcsTaskDefinitionArn', {
      value: taskDefinition.taskDefinitionArn,
      description: 'ECS task definition ARN',
    });

    new cdk.CfnOutput(this, 'VideoMergeLambdaName', {
      value: this.videoMergeLambda.functionName,
      description: 'Lambda function for triggering video merge',
    });

    new cdk.CfnOutput(this, 'VpcId', {
      value: vpc.vpcId,
      description: 'VPC ID for ECS',
    });

    new cdk.CfnOutput(this, 'PublicSubnetIds', {
      value: vpc.publicSubnets.map(subnet => subnet.subnetId).join(','),
      description: 'Public subnet IDs for ECS tasks (with internet access to ECR)',
    });
  }
} 