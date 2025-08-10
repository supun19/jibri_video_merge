# ECS Video Merge Solution

This solution uses AWS ECS Fargate to merge video files using FFmpeg in a Docker container, providing a scalable and cost-effective alternative to MediaConvert.

## Architecture Overview

```
Lambda → SQS → ECS Fargate → S3
  ↓         ↓        ↓        ↓
Receive  Queue   Process   Upload
Input    Task    Videos    Result
```

## Components

### 1. Lambda Function (`video-merge-ecs.js`)
- Receives video keys via API Gateway or direct invocation
- Sends task details to SQS queue
- Triggers ECS Fargate task
- Returns task ID and status immediately

### 2. SQS Queue
- Stores video processing tasks
- Provides reliable message delivery
- Enables task queuing and retry logic

### 3. ECS Fargate Service
- Runs Docker container with FFmpeg
- Downloads videos from S3
- Merges video streams using FFmpeg
- Uploads result back to S3
- Scales automatically based on demand

### 4. Docker Container
- Based on `jrottenberg/ffmpeg:latest`
- Includes Python for AWS SDK operations
- Processes SQS messages and S3 operations
- Uses FFmpeg for video merging

## Deployment Steps

### 1. Build and Push Docker Image

```bash
# Build the image
cd video-merge-docker
docker build -t video-merge .

# Login to ECR (will be done automatically by deploy script)
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Tag and push
docker tag video-merge:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/video-merge:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/video-merge:latest
```

### 2. Deploy CDK Stack

```bash
# Deploy the ECS stack
./deploy-ecs.sh
```

Or manually:

```bash
npx cdk deploy VideoMergeEcsStack
```

### 3. Test the Solution

Invoke the Lambda function with:

```json
{
  "mainVideoKey": "main-room/test22_20250810-062738.mp4",
  "translatorVideoKey": "translater/test22-observer_2025-08-10-07-08-49.mp4"
}
```

## How It Works

### 1. Input Processing
- Lambda receives video keys
- Generates unique task ID and output filename
- Sends message to SQS queue
- Triggers ECS Fargate task

### 2. Video Processing
- ECS task starts with environment variables
- Downloads both videos from S3 to `/tmp/`
- Runs FFmpeg to merge video from first file with audio from second
- Uploads merged result to S3
- Cleans up temporary files

### 3. Output
- Merged video uploaded to `s3://recording.htface/merge/`
- Filename format: `{original_name}_merged_{timestamp}.mp4`
- CloudWatch logs available for monitoring

## Configuration

### Environment Variables

**Lambda Function:**
- `ECS_CLUSTER_NAME`: ECS cluster name
- `ECS_TASK_DEFINITION_ARN`: ECS task definition ARN
- `SQS_QUEUE_URL`: SQS queue URL
- `S3_BUCKET`: S3 bucket name
- `VPC_SUBNET_IDS`: Comma-separated subnet IDs
- `VPC_SECURITY_GROUP_IDS`: Security group IDs

**ECS Container:**
- `TASK_ID`: Unique task identifier
- `MAIN_VIDEO_KEY`: S3 key for main video
- `TRANSLATOR_VIDEO_KEY`: S3 key for translator video
- `FINAL_OUTPUT_KEY`: S3 key for output video
- `SQS_QUEUE_URL`: SQS queue URL
- `S3_BUCKET`: S3 bucket name
- `AWS_REGION`: AWS region

### Resource Limits

- **ECS Task**: 4GB memory, 2 vCPU
- **Lambda**: 512MB memory, 5 minute timeout
- **SQS**: 30 second visibility timeout, 14 day retention

## Monitoring and Troubleshooting

### CloudWatch Logs

- **Lambda**: `/aws/lambda/{function-name}`
- **ECS**: `/ecs/video-merge`

### Common Issues

1. **VPC Configuration**: Ensure subnets and security groups are correctly configured
2. **IAM Permissions**: Verify ECS task role has S3 and SQS permissions
3. **Container Startup**: Check ECS task logs for container initialization issues
4. **FFmpeg Errors**: Review container logs for video processing errors

### Scaling

- ECS service starts with 0 desired count
- Tasks are created on-demand via Lambda
- Consider implementing auto-scaling based on SQS queue depth

## Cost Optimization

- **Fargate**: Pay only for compute time used
- **Spot Instances**: Use Fargate Spot for non-critical workloads
- **Task Optimization**: Right-size memory and CPU requirements
- **S3 Lifecycle**: Implement lifecycle policies for processed videos

## Security

- VPC isolation for ECS tasks
- IAM roles with least privilege access
- S3 bucket policies for access control
- CloudTrail for API call logging

## Comparison with MediaConvert

| Aspect | ECS Fargate | MediaConvert |
|--------|-------------|--------------|
| **Cost** | Pay per second | Pay per minute |
| **Control** | Full container control | Limited customization |
| **Scaling** | Manual/auto-scaling | Automatic |
| **Setup** | More complex | Simpler |
| **Flexibility** | High (custom scripts) | Medium (templates) |
| **Maintenance** | Self-managed | AWS-managed |

## Next Steps

1. **Auto-scaling**: Implement ECS service auto-scaling based on queue depth
2. **Monitoring**: Add CloudWatch alarms and SNS notifications
3. **Optimization**: Profile and optimize FFmpeg parameters
4. **Testing**: Implement comprehensive testing for different video formats
5. **CI/CD**: Set up automated deployment pipeline 