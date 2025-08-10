#!/bin/bash

echo "=== Deploying Video Merge ECS Stack ==="

# Print CDK command for later deployment
echo "=== CDK COMMAND TO RUN LATER ==="
echo "Run this command to deploy the infrastructure:"
echo "npx cdk deploy VideoMergeEcsStack --require-approval never --profile htface"
echo ""
echo "Expected CDK output will create:"
echo "- ECR Repository: video-merge"
echo "- VPC and networking"
echo "- ECS Cluster"
echo "- Lambda function"
echo "- IAM roles and policies"
echo "=== END CDK COMMAND ==="
echo ""

# Now build and push Docker image to ECR (repository now exists)
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

echo "=== Docker Deployment completed! ==="
echo ""
echo "Next steps:"
echo "1. Deploy CDK stack using the command above"
echo "2. Test the Lambda function with your video keys"
echo "3. Monitor ECS tasks in the AWS console"
echo "4. Check CloudWatch logs for container execution"
echo ""
echo "Note: ECR repository must exist before pushing Docker image"
echo "Run CDK deployment first to create the infrastructure!" 