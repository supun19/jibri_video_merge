const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs');

const ecs = new ECSClient({ region: process.env.AWS_REGION || 'us-east-1' });

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    const { mainVideoKey, translatorVideoKey } = event;
    
    if (!mainVideoKey || !translatorVideoKey) {
      throw new Error('Both mainVideoKey and translatorVideoKey are required');
    }
    
    // Generate unique task ID
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const taskId = `video-merge-${timestamp}`;
    
    // Generate output key - keep original filename but put in merge folder
    const originalFileName = mainVideoKey.split('/').pop(); // e.g., "test22_20250810-062738.mp4"
    const finalOutputKey = `merge/${originalFileName}`; // e.g., "merge/test22_20250810-062738.mp4"
    
    console.log('Starting video merge task:', {
      taskId,
      mainVideoKey,
      translatorVideoKey,
      finalOutputKey
    });
    
    // Get VPC configuration from environment variables
    const subnetIds = process.env.VPC_SUBNET_IDS.split(',');
    const securityGroupIds = process.env.VPC_SECURITY_GROUP_IDS ? [process.env.VPC_SECURITY_GROUP_IDS] : [];
    
    // Run ECS task
    const runTaskCommand = new RunTaskCommand({
      cluster: process.env.ECS_CLUSTER_NAME,
      taskDefinition: process.env.ECS_TASK_DEFINITION_ARN,
      launchType: 'FARGATE',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: subnetIds,
          securityGroups: securityGroupIds.length > 0 ? securityGroupIds : undefined,
          assignPublicIp: 'ENABLED'
        }
      },
      overrides: {
        containerOverrides: [
          {
            name: 'VideoMergeContainer',
            environment: [
              {
                name: 'TASK_ID',
                value: taskId
              },
              {
                name: 'MAIN_VIDEO_KEY',
                value: mainVideoKey
              },
              {
                name: 'TRANSLATOR_VIDEO_KEY',
                value: translatorVideoKey
              },
              {
                name: 'FINAL_OUTPUT_KEY',
                value: finalOutputKey
              },
              {
                name: 'S3_BUCKET',
                value: process.env.S3_BUCKET
              },
              {
                name: 'AWS_REGION',
                value: process.env.AWS_REGION || 'us-east-1'
              }
            ]
          }
        ]
      }
    });
    
    const runTaskResult = await ecs.send(runTaskCommand);
    console.log('ECS task started:', runTaskResult.tasks[0].taskArn);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Video merge task started successfully',
        taskId: taskId,
        taskArn: runTaskResult.tasks[0].taskArn,
        finalOutputKey: finalOutputKey,
        outputLocation: `s3://${process.env.S3_BUCKET}/${finalOutputKey}`,
        originalFileName: originalFileName
      })
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error starting video merge task',
        error: error.message
      })
    };
  }
}; 