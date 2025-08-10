#!/bin/bash

echo "=== ECS Video Merge Container Started ==="
echo "Current directory: $(pwd)"
echo "Environment variables:"
echo "TASK_ID: $TASK_ID"
echo "MAIN_VIDEO_KEY: $MAIN_VIDEO_KEY"
echo "TRANSLATOR_VIDEO_KEY: $TRANSLATOR_VIDEO_KEY"
echo "FINAL_OUTPUT_KEY: $FINAL_OUTPUT_KEY"
echo "S3_BUCKET: $S3_BUCKET"
echo "AWS_REGION: $AWS_REGION"

# Local file paths
MAIN_VIDEO_PATH="/tmp/$(basename $MAIN_VIDEO_KEY)"
TRANSLATOR_VIDEO_PATH="/tmp/$(basename $TRANSLATOR_VIDEO_KEY)"
OUTPUT_PATH="/tmp/merged_output.mp4"

echo "Processing task: $TASK_ID"
echo "Main video: $MAIN_VIDEO_KEY"
echo "Translator video: $TRANSLATOR_VIDEO_KEY"
echo "Output: $FINAL_OUTPUT_KEY"

# Download videos from S3 using AWS CLI
echo "Downloading main video from S3..."
aws s3 cp "s3://$S3_BUCKET/$MAIN_VIDEO_KEY" "$MAIN_VIDEO_PATH"

echo "Downloading translator video from S3..."
aws s3 cp "s3://$S3_BUCKET/$TRANSLATOR_VIDEO_KEY" "$TRANSLATOR_VIDEO_PATH"

# Check if downloads were successful
if [ ! -f "$MAIN_VIDEO_PATH" ]; then
    echo "Error: Failed to download main video"
    exit 1
fi

if [ ! -f "$TRANSLATOR_VIDEO_PATH" ]; then
    echo "Error: Failed to download translator video"
    exit 1
fi

echo "Videos downloaded successfully!"

# Run FFmpeg with the exact same configuration that works locally
echo "Running FFmpeg..."
echo "Video 1 (keep video): $MAIN_VIDEO_PATH"
echo "Video 2 (keep audio): $TRANSLATOR_VIDEO_PATH"
echo "Output: $OUTPUT_PATH"

ffmpeg -i "$MAIN_VIDEO_PATH" -i "$TRANSLATOR_VIDEO_PATH" -map 0:v -map 1:a -c:v copy -c:a aac -strict experimental "$OUTPUT_PATH"

# Check if FFmpeg was successful
if [ $? -eq 0 ]; then
    echo "FFmpeg completed successfully!"
    echo "Successfully created: $OUTPUT_PATH"
    echo "Output file size: $(ls -lh "$OUTPUT_PATH")"
    
    # Upload result to S3
    echo "Uploading merged video to S3..."
    aws s3 cp "$OUTPUT_PATH" "s3://$S3_BUCKET/$FINAL_OUTPUT_KEY"
    
    if [ $? -eq 0 ]; then
        echo "Upload successful! File available at: s3://$S3_BUCKET/$FINAL_OUTPUT_KEY"
    else
        echo "Error: Failed to upload to S3"
        exit 1
    fi
    
    # Clean up local files
    rm -f "$MAIN_VIDEO_PATH" "$TRANSLATOR_VIDEO_PATH" "$OUTPUT_PATH"
    echo "Local files cleaned up"
    
else
    echo "Error: FFmpeg failed to process the videos"
    exit 1
fi

echo "=== ECS Video Merge Container Completed Successfully ===" 