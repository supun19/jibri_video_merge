# Simplified Video Merge Architecture

## 🎯 **Much Simpler Approach - Exactly What You Wanted!**

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    SIMPLIFIED WORKFLOW                                                    │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    INPUT LAYER                                                             │
│                                                                                                             │
│  ┌─────────────────────────────────┐    ┌─────────────────────────────────┐                               │
│  │         MAIN VIDEO              │    │      TRANSLATOR VIDEO           │                               │
│  │                                 │    │                                 │                               │
│  │  S3: recording.htface           │    │  S3: recording.htface           │                               │
│  │  Path: main-room/               │    │  Path: translater/              │                               │
│  │  Format: MP4 (Video + Audio)    │    │  Format: MP4 (Video + Audio)    │                               │
│  └─────────────────────────────────┘    └─────────────────────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    STEP 1: AUDIO EXTRACTION                                               │
│                                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                              AUDIO EXTRACTION LAMBDA                                                   │ │
│  │                                                                                                         │ │
│  │  Function: simple-video-merge.handler                                                                   │ │
│  │  Input: { mainVideoKey, translatorVideoKey }                                                            │ │
│  │                                                                                                         │ │
│  │  Actions:                                                                                               │ │
│  │  1. Creates MediaConvert job to extract audio                                                           │ │
│  │  2. Waits for job completion (polling)                                                                  │ │
│  │  3. Uploads extracted audio to temp-audio/ folder                                                       │ │
│  │  4. Sends message to SQS with main video + temp audio keys                                              │ │
│  │                                                                                                         │ │
│  │  Output: Audio file in temp-audio/ folder                                                              │ │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    SQS MESSAGE                                                            │
│                                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                                    SQS QUEUE                                                            │ │
│  │                                                                                                         │ │
│  │  Name: video-processing-queue                                                                           │ │
│  │  Message Format:                                                                                        │ │
│  │  {                                                                                                      │ │
│  │    "mainVideoKey": "main-room/test22.mp4",                                                              │ │
│  │    "extractedAudioKey": "temp-audio/test22_audio_timestamp.mp4",                                        │ │
│  │    "finalOutputKey": "merge/test22_merged_timestamp.mp4",                                               │ │
│  │    "timestamp": "2025-01-27T10:30:00.000Z"                                                             │ │
│  │  }                                                                                                      │ │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    STEP 2: VIDEO MERGING                                                  │
│                                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                                VIDEO MERGE LAMBDA                                                       │ │
│  │                                                                                                         │ │
│  │  Function: simple-merge-video.handler                                                                   │ │
│  │  Trigger: SQS Event Source                                                                              │ │
│  │                                                                                                         │ │
│  │  Actions:                                                                                               │ │
│  │  1. Receives SQS message with main video + temp audio keys                                              │ │
│  │  2. Creates MediaConvert job to merge video + audio                                                     │ │
│  │  3. Outputs final merged video to merge/ folder                                                         │ │
│  │                                                                                                         │ │
│  │  Output: Final merged video with both audio tracks                                                      │ │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    OUTPUT LAYER                                                            │
│                                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                                    S3 BUCKET                                                            │ │
│  │                                                                                                         │ │
│  │  Name: recording.htface                                                                                 │ │
│  │  Structure:                                                                                             │ │
│  │                                                                                                         │ │
│  │  ├── main-room/                    # Main video files                                                   │ │
│  │  ├── translater/                   # Translator video files                                            │ │
│  │  ├── temp-audio/                   # Extracted audio files                                             │ │
│  │  └── merge/                        # Final merged videos                                               │ │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

## 🔄 **Complete Workflow (3 Simple Steps)**

### **Step 1: Audio Extraction**
```bash
# Invoke Lambda 1
aws lambda invoke \
  --function-name AudioExtractionLambda \
  --payload '{"mainVideoKey":"main-room/test22.mp4","translatorVideoKey":"translater/test22.mp4"}' \
  response.json
```

**What happens:**
1. ✅ Extracts audio from translator video
2. ✅ Uploads to `temp-audio/` folder
3. ✅ Sends message to SQS

### **Step 2: SQS Message (Automatic)**
```json
{
  "mainVideoKey": "main-room/test22.mp4",
  "extractedAudioKey": "temp-audio/test22_audio_timestamp.mp4",
  "finalOutputKey": "merge/test22_merged_timestamp.mp4",
  "timestamp": "2025-01-27T10:30:00.000Z"
}
```

### **Step 3: Video Merging (Automatic)**
- ✅ SQS automatically triggers Lambda 2
- ✅ Creates MediaConvert merge job
- ✅ Combines main video + extracted audio
- ✅ Outputs to `merge/` folder

## 🎯 **Key Benefits of This Simplified Approach**

### **✅ What We Removed (Complexity):**
- ❌ SNS Topic
- ❌ Complex notification system
- ❌ Job completion handler
- ❌ Multiple Lambda orchestrations
- ❌ Complex metadata passing

### **✅ What We Kept (Simplicity):**
- ✅ 2 Lambda functions only
- ✅ 1 SQS queue for communication
- ✅ Direct MediaConvert integration
- ✅ Simple message passing
- ✅ Easy to understand and debug

## 🚀 **How to Use**

### **1. Deploy the Simplified Stack**
```bash
cdk deploy SimpleVideoMergeStack
```

### **2. Invoke Audio Extraction**
```bash
aws lambda invoke \
  --function-name AudioExtractionLambda \
  --payload '{"mainVideoKey":"main-room/test22.mp4","translatorVideoKey":"translater/test22.mp4"}' \
  response.json
```

### **3. Everything Else is Automatic!**
- Audio extraction completes
- Message sent to SQS
- Video merge Lambda triggers
- Final video created

## 🔍 **Monitoring**

- **CloudWatch Logs**: Check both Lambda functions
- **SQS Console**: See messages in the queue
- **MediaConvert Console**: Monitor job progress
- **S3**: Check temp-audio/ and merge/ folders

## 💡 **Why This is Much Better**

1. **🎯 Simple**: Only 2 Lambda functions instead of 3
2. **🔍 Easy to Debug**: Clear flow, easy to trace
3. **📝 Less Code**: Removed complex notification logic
4. **⚡ Faster**: No SNS delays, direct SQS communication
5. **🛠️ Easier to Maintain**: Less moving parts
6. **💰 Cost Effective**: Fewer AWS services

**This is exactly what you wanted - simple, clean, and easy to understand!** 🎉 