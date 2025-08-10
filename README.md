# Video and Audio Merge Solution

This AWS CDK project creates an infrastructure for merging video and audio files using AWS Elemental MediaConvert. The solution takes two video files from S3, replaces the audio from the main video with the audio from the translator video, and outputs the merged result to a specified S3 location.

## Architecture

- **S3 Bucket**: `recording.htface` - existing bucket that stores input videos and merged output
- **Lambda Function**: Handles MediaConvert job creation and management
- **MediaConvert**: AWS service that performs the actual video/audio processing
- **IAM Roles**: Proper permissions for Lambda and MediaConvert to access the existing S3 bucket

## How It Works

1. **Input**: Two S3 keys for video files:
   - Main video: `main/test22_2025-08-09-16-50-27.mp4` (keeps video, audio removed)
   - Translator video: `tranlator/test22_2025-08-09-16-50-27.mp4` (audio source)

2. **Process**: 
   - Lambda function creates a MediaConvert job
   - MediaConvert extracts video from main file and audio from translator file
   - The audio from translator video replaces the audio from main video
   - Audio starts from the beginning and syncs with the video timeline
   - If translator audio is shorter than main video, it will loop/repeat

3. **Output**: Merged video file with timestamp in the filename

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
   - Lambda function name and ARN

## Usage

### Invoking the Lambda Function

You can invoke the Lambda function from the AWS Console or using AWS CLI with the following event structure:

```json
{
  "mainVideoKey": "main/test22_2025-08-09-16-50-27.mp4",
  "translatorVideoKey": "tranlator/test22_2025-08-09-16-50-27.mp4"
}
```

### AWS CLI Example

```bash
aws lambda invoke \
  --function-name [YOUR_LAMBDA_FUNCTION_NAME] \
  --payload '{"mainVideoKey":"main/test22_2025-08-09-16-50-27.mp4","translatorVideoKey":"tranlator/test22_2025-08-09-16-50-27.mp4"}' \
  response.json
```

### Expected Response

```json
{
  "statusCode": 200,
  "body": {
    "message": "Video merge job created successfully",
    "jobId": "1234567890",
    "outputKey": "merge/test22_2025-08-09-16-50-27_merged_2025-01-27T10-30-00-000Z.mp4",
    "status": "SUBMITTED"
  }
}
```

## MediaConvert Job Details

The solution creates a MediaConvert job that:
- Takes the video stream from the main video file
- Takes the audio stream from the translator video file
- Outputs an MP4 file with H.264 video and AAC audio
- Uses high-quality encoding settings for optimal output

## Audio Overlapping Behavior

**Example Scenario 1:**
- Main video: 3 minutes long
- Translator video: 2 minutes long

**Result:**
- Final video: 3 minutes long
- Video: From main video (3 minutes)
- Audio: Main video audio + Translator audio overlapping
- Translator audio starts at 1:00 and ends at 3:00 (last 2 minutes)
- 0:00-1:00: Main video audio only
- 1:00-3:00: Main video audio + Translator audio (overlapping)

**Example Scenario 2:**
- Main video: 20 minutes long
- Translator video: 21 minutes long

**Result:**
- Final video: 20 minutes long
- Video: From main video (20 minutes)
- Audio: Main video audio + Translator audio overlapping
- Translator audio starts at 0:00 and ends at 20:00 (first 20 minutes)

**Key Features:**
- Main video audio is preserved and mixed with translator audio
- Translator audio is positioned to END at the same time as main video
- If translator is shorter: starts later to end together
- If translator is longer: starts from beginning, gets truncated
- Both audio tracks play simultaneously (overlapping)

## Project Structure

```
MergeTranlatorAndMainRoom/
├── bin/                            # CDK app entry point
├── lib/                            # CDK stack definitions
├── lambda/                         # Lambda function code
│   ├── video-merge.js             # Main Lambda function
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
└── merge/                          # Merged output files
    └── [filename]_merged_[timestamp].mp4
```

## Monitoring

- **CloudWatch Logs**: Lambda function logs are available in CloudWatch
- **MediaConvert Console**: Monitor job progress and status
- **S3**: Check the merge folder for completed files

## Cost Considerations

- **MediaConvert**: Pay per minute of output video
- **Lambda**: Pay per request and execution time
- **S3**: Storage and data transfer costs
- **CloudWatch**: Log storage and monitoring costs

## Security

- S3 bucket encryption enabled
- IAM roles with least privilege access
- CORS configured for web access if needed
- Versioning enabled for data protection

## Troubleshooting

### Common Issues

1. **Permission Denied**: Check IAM roles and policies, ensure the existing S3 bucket allows the Lambda and MediaConvert roles to read/write
2. **S3 File Not Found**: Verify file paths and bucket names
3. **MediaConvert Job Failed**: Check CloudWatch logs for detailed error messages
4. **Timeout Errors**: Increase Lambda timeout if processing large files
5. **Bucket Access Issues**: Verify the existing S3 bucket `recording.htface` exists and has proper permissions

### Debugging

- Check Lambda function logs in CloudWatch
- Verify S3 bucket permissions
- Ensure MediaConvert service is available in your region
- Check IAM role trust relationships

## Customization

You can modify the solution by:
- Changing video/audio codec settings
- Adjusting output quality parameters
- Adding additional input validation
- Implementing job status monitoring
- Adding SNS notifications for job completion

## Support

For issues or questions:
1. Check CloudWatch logs first
2. Verify AWS service quotas and limits
3. Review IAM permissions
4. Check MediaConvert service status in your region
