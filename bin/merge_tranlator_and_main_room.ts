#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VideoMergeEcsStack } from '../lib/video-merge-ecs-stack';
import { AutomatedVideoProcessorStack } from '../lib/automated-video-processor-stack';
import * as lambda from 'aws-cdk-lib/aws-lambda';

const app = new cdk.App();

// ECS-based manual trigger stack
const videoMergeStack = new VideoMergeEcsStack(app, 'VideoMergeEcsStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
});

// New automated video processor stack
const automatedStack = new AutomatedVideoProcessorStack(app, 'AutomatedVideoProcessorStack', {
  videoMergeLambda: videoMergeStack.videoMergeLambda,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
});

// Establish dependency: AutomatedVideoProcessorStack depends on VideoMergeEcsStack
automatedStack.addDependency(videoMergeStack);