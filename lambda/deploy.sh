#!/bin/bash

echo "Installing dependencies..."
npm install

echo "Creating deployment package..."
npm run package

echo "Deployment package created: function.zip"
echo "You can now upload this to AWS Lambda or use it with CDK deployment" 