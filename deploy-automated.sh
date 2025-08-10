#!/bin/bash

echo "=== Deploying Automated Video Processor Stack ==="

# Print CDK command for deployment
echo "=== CDK COMMAND TO RUN ==="
echo "Run this command to deploy the automated infrastructure:"
echo "npx cdk deploy AutomatedVideoProcessorStack --require-approval never --profile htface"
echo ""
echo "Expected CDK output will create:"
echo "- ECR Repository: video-merge"
echo "- DynamoDB Table: video-file-tracking"
echo "- ECS Cluster: automated-video-merge-cluster"
echo "- Lambda function with S3 triggers"
echo "- IAM roles and policies"
echo "=== END CDK COMMAND ==="
echo ""

# Now build and push Docker image to ECR (repository will be created by CDK)
echo "Building Docker image..."
cd video-merge-docker
docker build -t video-merge .

# Get AWS account ID and region using htface profile
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --profile htface --query Account --output text)
AWS_REGION=$(aws configure get region --profile htface)
ECR_REPO_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/video-merge"

echo "AWS Account ID: $AWS_ACCOUNT_ID"
echo "AWS Region: $AWS_REGION"
echo "ECR Repository URI: $ECR_REPO_URI"

# Login to ECR
echo "Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION --profile htface | docker login --username AWS --password-stdin $ECR_REPO_URI

# Tag and push image
echo "Tagging and pushing Docker image..."
docker tag video-merge:latest $ECR_REPO_URI:latest
docker push $ECR_REPO_URI:latest

echo "Docker image pushed successfully!"

# Go back to root directory
cd ..

echo "=== Automated Video Processor Deployment completed! ==="
echo ""
echo "Next steps:"
echo "1. Deploy CDK stack using the command above"
echo "2. Upload test files to S3:"
echo "   - main-room/test22_20250810-062738.mp4"
echo "   - translater/test22-observer_2025-08-10-07-08-49.mp4"
echo "3. Monitor Lambda execution in CloudWatch"
echo "4. Check DynamoDB table for file tracking"
echo "5. Monitor ECS tasks for video merging"
echo ""
echo "Note: ECR repository must exist before pushing Docker image"
echo "Run CDK deployment first to create the infrastructure!" 