# Video and Audio Merge Solution

This AWS CDK project creates an infrastructure for merging video and audio files using AWS Elemental MediaConvert. The solution takes two video files from S3, replaces the audio from the main video with the audio from the translator video, and outputs the merged result to a specified S3 location.

## Architecture

- **S3 Bucket**: `recording.htface` - existing bucket that stores input videos and merged output
- **Lambda Functions**: 
  - `VideoMergeLambda`: Handles initial audio extraction job creation
  - `CreateMergeJobLambda`: Creates the final merge job
  - `JobCompletionHandlerLambda`: Automatically triggers merge jobs when audio extraction completes
- **MediaConvert**: AWS service that performs the actual video/audio processing
- **SNS Topic**: Receives MediaConvert job completion notifications
- **SQS Queue**: Processes job completion events and triggers the next step
- **IAM Roles**: Proper permissions for Lambda and MediaConvert to access the existing S3 bucket

## How It Works

### Automated Workflow

1. **Input**: Two S3 keys for video files:
   - Main video: `main/test22_2025-08-09-16-50-27.mp4` (provides video and original audio)
   - Translator video: `tranlator/test22_2025-08-09-16-50-27.mp4` (provides additional audio track)

2. **Process**: 
   - **Step 1**: `VideoMergeLambda` creates a MediaConvert job to extract audio from translator MP4 file
   - **Step 2**: When audio extraction completes, MediaConvert sends an SNS notification
   - **Step 3**: SNS notification is received by SQS queue
   - **Step 4**: `JobCompletionHandlerLambda` processes the completion event and automatically invokes `CreateMergeJobLambda`
   - **Step 5**: `CreateMergeJobLambda` creates the final merge job
   - MediaConvert takes video and audio from main file (Input 1)
   - MediaConvert uses extracted audio file (Input 2)
   - Both audio tracks are mixed together in the final output
   - The video duration matches the main video
   - Both audio tracks play simultaneously (overlapping)

3. **Output**: Merged video file with timestamp in the filename

### Manual Workflow (Fallback)

If the automated workflow fails, you can still manually create the final merge job using the `CreateMergeJobLambda` function with the required parameters from the audio extraction response.

## Deployment

### Prerequisites
- AWS CLI configured with appropriate credentials
- Node.js and npm installed
- AWS CDK CLI installed (`npm install -g aws-cdk`)
- Existing S3 bucket named `recording.htface` with appropriate permissions

### Steps

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build the project**:
   ```bash
   npm run build
   ```

3. **Deploy the stack**:
   ```bash
   cdk deploy
   ```

4. **Note the outputs**:
   - S3 bucket name
   - Lambda function names and ARNs
   - SNS Topic ARN
   - SQS Queue URL

## Usage

### Invoking the Main Lambda Function

You can invoke the `VideoMergeLambda` function from the AWS Console or using AWS CLI with the following event structure:

```json
{
  "mainVideoKey": "main/test22_2025-08-09-16-50-27.mp4",
  "translatorVideoKey": "tranlator/test22_2025-08-09-16-50-27.mp4"
}
```

### AWS CLI Example

```bash
aws lambda invoke \
  --function-name [YOUR_VIDEO_MERGE_LAMBDA_FUNCTION_NAME] \
  --payload '{"mainVideoKey":"main/test22_2025-08-09-16-50-27.mp4","translatorVideoKey":"tranlator/test22_2025-08-09-16-50-27.mp4"}' \
  response.json
```

### Expected Response

```json
{
  "statusCode": 200,
  "body": {
    "message": "Audio extraction job created successfully. Final merge job will be automatically created when audio extraction completes.",
    "audioExtractionJobId": "1234567890",
    "audioExtractKey": "temp-audio/test22-observer_2025-08-09-16-50-27_audio_2025-01-27T10-30-00-000Z.mp4",
    "finalOutputKey": "merge/test22_2025-08-09-16-50-27_merged_2025-01-27T10-30-00-000Z.mp4",
    "status": "AUDIO_EXTRACTION_IN_PROGRESS",
    "nextSteps": [
      {
        "step": 1,
        "description": "Audio extraction from translator video",
        "jobId": "1234567890",
        "status": "SUBMITTED",
        "action": "Monitor this job in MediaConvert console"
      },
      {
        "step": 2,
        "description": "Final merge job creation (AUTOMATIC)",
        "action": "Will be automatically triggered when Step 1 completes via SNS notification",
        "requiredInputs": {
          "mainVideoKey": "main/test22_2025-08-09-16-50-27.mp4",
          "extractedAudioKey": "temp-audio/test22-observer_2025-08-09-16-50-27_audio_2025-01-27T10-30-00-000Z.mp4",
          "finalOutputKey": "merge/test22_2025-08-09-16-50-27_merged_2025-01-27T10-30-00-000Z.mp4"
        }
      }
    ],
    "instructions": "The audio extraction job is now running. When it completes, MediaConvert will automatically send an SNS notification that triggers the final merge job creation. No manual intervention required.",
    "automation": {
      "enabled": true,
      "mechanism": "SNS notification + SQS + Lambda",
      "description": "Job completion automatically triggers final merge job creation"
    }
  }
}
```

## MediaConvert Job Details

The solution creates **two** MediaConvert jobs automatically:

**Job 1: Audio Extraction**
- Extracts audio from translator MP4 file
- Outputs MP4 file with minimal video and extracted audio to `temp-audio/` folder
- Uses H.264 video (minimal) and AAC audio codec with 128kbps bitrate
- **Automatically triggers Job 2 when complete**

**Job 2: Final Merge**
- Automatically created when Job 1 completes
- Takes video and audio from main video file (Input 1)
- Uses extracted audio file (Input 2)
- Mixes both audio tracks together in the final output
- Outputs MP4 file with H.264 video and AAC audio
- Uses high-quality encoding settings for optimal output

## Automation Components

### SNS Topic
- **Name**: `mediaconvert-job-notifications`
- **Purpose**: Receives MediaConvert job completion notifications
- **Subscribers**: SQS queue

### SQS Queue
- **Name**: `mediaconvert-job-completion-queue`
- **Purpose**: Processes job completion events
- **Dead Letter Queue**: Handles failed message processing
- **Event Source**: Triggers `JobCompletionHandlerLambda`

### Lambda Functions
- **`VideoMergeLambda`**: Creates audio extraction job
- **`JobCompletionHandlerLambda`**: Processes completion events and triggers merge job
- **`CreateMergeJobLambda`**: Creates the final merge job

## Audio Overlapping Behavior

**Example Scenario 1:**
- Main video: 3 minutes long
- Translator video: 2 minutes long

**Result:**
- Final video: 3 minutes long
- Video: From main video (3 minutes)
- Audio: Main video audio + Translator audio overlapping
- Both audio tracks start at 0:00
- 0:00-2:00: Main video audio + Translator audio (overlapping)
- 2:00-3:00: Main video audio only (translator audio loops/repeats)

**Example Scenario 2:**
- Main video: 20 minutes long
- Translator video: 21 minutes long

**Result:**
- Final video: 20 minutes long
- Video: From main video (20 minutes)
- Audio: Main video audio + Translator audio overlapping
- Both audio tracks start at 0:00 and play for 20 minutes
- Translator audio gets truncated at 20:00 (last minute is lost)

**Key Features:**
- Main video audio is preserved and mixed with translator audio
- Both audio tracks start from the beginning and play simultaneously
- The final video duration matches the main video duration
- If translator audio is shorter: it will loop/repeat to match main video length
- If translator audio is longer: it will be truncated to match main video length
- Both audio tracks play simultaneously (overlapping) throughout the entire duration

## Project Structure

```
MergeTranlatorAndMainRoom/
├── bin/                            # CDK app entry point
├── lib/                            # CDK stack definitions
├── lambda/                         # Lambda function code
│   ├── video-merge.js             # Main Lambda function (Step 1)
│   ├── create-merge-job.js        # Final merge job creator (Step 2)
│   ├── job-completion-handler.js  # Job completion event processor
│   └── package.json               # Lambda dependencies
├── test-lambda.js                  # Test script for Lambda
├── deploy.sh                       # Deployment script
└── README.md                       # This file
```

## S3 File Structure

```
recording.htface/
├── main/                           # Main video files (video + audio)
├── tranlator/                      # Translator video files (audio source)
├── temp-audio/                     # Temporary extracted audio files
│   └── [filename]_audio_[timestamp].mp4
└── merge/                          # Merged output files
    └── [filename]_merged_[timestamp].mp4
```

## Monitoring

- **CloudWatch Logs**: All Lambda function logs are available in CloudWatch
- **MediaConvert Console**: Monitor job progress and status
- **S3**: Check the merge folder for completed files
- **SQS Console**: Monitor job completion event processing
- **SNS Console**: Monitor MediaConvert notifications

## Cost Considerations

- **MediaConvert**: Pay per minute of output video
- **Lambda**: Pay per request and execution time
- **S3**: Storage and data transfer costs
- **CloudWatch**: Log storage and monitoring costs
- **SNS**: Minimal cost for job notifications
- **SQS**: Minimal cost for message processing

## Security

- S3 bucket encryption enabled
- IAM roles with least privilege access
- CORS configured for web access if needed
- Versioning enabled for data protection
- SQS queue with dead letter queue for failed message handling

## Troubleshooting

### Common Issues

1. **Permission Denied**: Check IAM roles and policies, ensure the existing S3 bucket allows the Lambda and MediaConvert roles to read/write
2. **S3 File Not Found**: Verify file paths and bucket names
3. **MediaConvert Job Failed**: Check CloudWatch logs for detailed error messages
4. **Timeout Errors**: Increase Lambda timeout if processing large files
5. **Bucket Access Issues**: Verify the existing S3 bucket `recording.htface` exists and has proper permissions
6. **Automation Not Working**: Check SNS topic subscriptions, SQS queue configuration, and Lambda function permissions

### Debugging

- Check Lambda function logs in CloudWatch
- Verify S3 bucket permissions
- Ensure MediaConvert service is available in your region
- Check IAM role trust relationships
- Monitor SNS topic and SQS queue for message flow
- Verify Lambda function environment variables

### Manual Fallback

If the automated workflow fails, you can manually create the final merge job:

```bash
aws lambda invoke \
  --function-name [YOUR_CREATE_MERGE_JOB_LAMBDA_FUNCTION_NAME] \
  --payload '{"mainVideoKey":"main/test22_2025-08-09-16-50-27.mp4","extractedAudioKey":"temp-audio/test22-observer_2025-08-09-16-50-27_audio_2025-01-27T10-30-00-000Z.mp4","finalOutputKey":"merge/test22_2025-08-09-16-50-27_merged_2025-01-27T10-30-00-000Z.mp4"}' \
  response.json
```

## Customization

You can modify the solution by:
- Changing video/audio codec settings
- Adjusting output quality parameters
- Adding additional input validation
- Implementing job status monitoring
- Adding SNS notifications for job completion
- Customizing the automation workflow
- Adding additional error handling and retry logic

## Support

For issues or questions:
1. Check CloudWatch logs first
2. Verify AWS service quotas and limits
3. Review IAM permissions
4. Check MediaConvert service status in your region
5. Monitor SNS and SQS message flow
6. Verify Lambda function environment variables and permissions
