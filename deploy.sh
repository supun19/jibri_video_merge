#!/bin/bash

echo "🚀 Starting AWS CDK deployment for Video Merge Solution..."

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI is not configured. Please run 'aws configure' first."
    exit 1
fi

# Check if CDK is installed
if ! command -v cdk &> /dev/null; then
    echo "❌ AWS CDK is not installed. Installing now..."
    npm install -g aws-cdk
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building the project..."
npm run build

# Install Lambda dependencies
echo "📦 Installing Lambda dependencies..."
cd lambda && npm install && cd ..

# Bootstrap CDK (if needed)
echo "🔧 Checking if CDK is bootstrapped..."
if ! cdk list &> /dev/null; then
    echo "🚀 Bootstrapping CDK..."
    cdk bootstrap
fi

# Deploy the stack
echo "🚀 Deploying the stack..."
cdk deploy --require-approval never

echo "✅ Deployment completed!"
echo ""
echo "📋 Next steps:"
echo "1. Note the Lambda function name from the output above"
echo "2. Update the test-lambda.js file with your function name"
echo "3. Test the function using: node test-lambda.js"
echo "4. Check the S3 bucket 'recording.htface' for merged videos"
echo ""
echo "🔍 To monitor:"
echo "- Lambda logs: CloudWatch > Log groups > /aws/lambda/[function-name]"
echo "- MediaConvert jobs: MediaConvert console"
echo "- S3 files: S3 console > recording.htface bucket" 