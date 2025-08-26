const { DynamoDBClient, PutItemCommand, QueryCommand, ScanCommand, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const lambda = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Parse filename to extract room name and timestamp
function parseFileName(fileKey) {
  const fileName = fileKey.split('/').pop(); // Get filename without path
  const folder = fileKey.split('/')[0]; // Get folder name
  
  if (folder === 'main-room') {
    // Format: test22_20250810-062738.mp4
    // Extract: roomName = test22, timestamp = 20250810-062738
    const match = fileName.match(/^(.+)_(\d{8}-\d{6})\.mp4$/);
    if (match) {
      return {
        roomName: match[1],
        timestamp: match[2],
        fileType: 'main',
        parsed: true
      };
    }
  } else if (folder === 'translater') {
    // Format: test22-observer_2025-08-10-07-08-49.mp4
    // Extract: roomName = test22, timestamp = 2025-08-10-07-08-49
    const match = fileName.match(/^(.+)-observer_(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})\.mp4$/);
    if (match) {
      return {
        roomName: match[1],
        timestamp: match[2],
        fileType: 'translator',
        parsed: true
      };
    }
  }
  
  return { parsed: false };
}

// Convert timestamp to Date object for comparison
function parseTimestamp(timestamp, fileType) {
  let normalizedTimestamp;
  
  if (fileType === 'main') {
    // Format: 20250810-062738 -> convert to 2025-08-10-06-27-38
    const year = timestamp.substring(0, 4);
    const month = timestamp.substring(4, 6);
    const day = timestamp.substring(6, 8);
    const hour = timestamp.substring(9, 11);
    const minute = timestamp.substring(11, 13);
    const second = timestamp.substring(13, 15);
    normalizedTimestamp = `${year}-${month}-${day}-${hour}-${minute}-${second}`;
  } else {
    // Format: 2025-08-10-07-08-49 -> already in correct format
    normalizedTimestamp = timestamp;
  }
  
  // Convert normalized timestamp to Date object
  const parts = normalizedTimestamp.split('-');
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  const hour = parts[3];
  const minute = parts[4];
  const second = parts[5];
  
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
}

// Check if two timestamps are within the time window
function isWithinTimeWindow(timestamp1, timestamp2, windowMinutes = 15) {
  const diffMs = Math.abs(timestamp1.getTime() - timestamp2.getTime());
  const diffMinutes = diffMs / (1000 * 60);
  return diffMinutes <= windowMinutes;
}

// Add file record to DynamoDB
async function addFileRecord(roomName, timestamp, fileType, fileKey) {
  const ttl = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours from now
  
  // Normalize timestamp to consistent format
  let normalizedTimestamp;
  if (fileType === 'main') {
    // Convert 20250810-062738 to 2025-08-10-06-27-38
    const year = timestamp.substring(0, 4);
    const month = timestamp.substring(4, 6);
    const day = timestamp.substring(6, 8);
    const hour = timestamp.substring(9, 11);
    const minute = timestamp.substring(11, 13);
    const second = timestamp.substring(13, 15);
    normalizedTimestamp = `${year}-${month}-${day}-${hour}-${minute}-${second}`;
  } else {
    // Already in correct format: 2025-08-10-07-08-49
    normalizedTimestamp = timestamp;
  }

  // Check if record already exists
  try {
    const existingRecord = await dynamodb.send(new GetItemCommand({
      TableName: process.env.DYNAMODB_TABLE,
      Key: marshall({
        roomName: roomName,
        timestamp: normalizedTimestamp
      })
    }));

    if (existingRecord.Item) {
      console.log(`Record already exists for ${roomName} at ${normalizedTimestamp}, skipping duplicate`);
      return true; // Return true since we don't want to fail the process
    }
  } catch (error) {
    console.error('Error checking existing record:', error);
    // Continue with adding the record if check fails
  }
  
  const item = marshall({
    roomName: roomName,
    timestamp: normalizedTimestamp, // Store normalized format
    originalTimestamp: timestamp,   // Keep original for reference
    fileType: fileType,
    fileKey: fileKey,
    uploadTime: new Date().toISOString(),
    ttl: ttl
  });

  try {
    await dynamodb.send(new PutItemCommand({
      TableName: process.env.DYNAMODB_TABLE,
      Item: item
    }));
    console.log(`Added file record: ${roomName}-${fileType} at ${normalizedTimestamp} (original: ${timestamp})`);
    return true;
  } catch (error) {
    console.error('Error adding file record:', error);
    return false;
  }
}

// Find matching file for the same room within time window
async function findMatchingFile(roomName, currentTimestamp, currentFileType, timeWindowMinutes = 15) {
  try {
    console.log('Finding matching file for room:', roomName);
    console.log('Current timestamp:', currentTimestamp);
    console.log('Current file type:', currentFileType);
    console.log('Time window:', timeWindowMinutes);
    
    // Query for files of the opposite type for the same room
    const oppositeType = currentFileType === 'main' ? 'translator' : 'main';
    
    const response = await dynamodb.send(new QueryCommand({
      TableName: process.env.DYNAMODB_TABLE,
      IndexName: 'fileTypeIndex',
      KeyConditionExpression: 'fileType = :fileType',
      FilterExpression: 'roomName = :roomName',
      ExpressionAttributeValues: marshall({
        ':fileType': oppositeType,
        ':roomName': roomName
      })
    }));
    console.log('Response:', response);

    if (!response.Items || response.Items.length === 0) {
      return null;
    }

    // Find the closest timestamp within the time window
    const currentTime = parseTimestamp(currentTimestamp, currentFileType);
    console.log('Current time:', currentTime);
    let bestMatch = null;
    let smallestDiff = Infinity;

    for (const item of response.Items) {
      const itemData = unmarshall(item);
      console.log('Item data:', itemData);
      const itemTime = parseTimestamp(itemData.originalTimestamp, itemData.fileType);
      console.log('Item time:', itemTime);
      if (isWithinTimeWindow(currentTime, itemTime, timeWindowMinutes)) {
        const diff = Math.abs(currentTime.getTime() - itemTime.getTime());
        if (diff < smallestDiff) {
          smallestDiff = diff;
          bestMatch = itemData;
        }
      }
    }

    return bestMatch;
  } catch (error) {
    console.error('Error finding matching file:', error);
    return null;
  }
}

// Trigger video merge by calling the existing VideoMergeEcsStack Lambda
async function triggerVideoMerge(mainVideoKey, translatorVideoKey, roomName) {
  console.log('Triggering video merge via existing VideoMergeEcsStack Lambda:', {
    mainVideoKey,
    translatorVideoKey,
    roomName
  });

  try {
    // Call the existing VideoMergeEcsStack Lambda function
    // You'll need to set this environment variable to the function name
    const videoMergeLambdaName = process.env.VIDEO_MERGE_LAMBDA_NAME;
    
    if (!videoMergeLambdaName) {
      throw new Error('VIDEO_MERGE_LAMBDA_NAME environment variable not set');
    }

    const invokeCommand = new InvokeCommand({
      FunctionName: videoMergeLambdaName,
      InvocationType: 'Event', // Async invocation
      Payload: JSON.stringify({
        mainVideoKey: mainVideoKey,
        translatorVideoKey: translatorVideoKey
      })
    });

    const result = await lambda.send(invokeCommand);
    console.log('Video merge Lambda invoked successfully:', result);
    
    return {
      success: true,
      invocationResult: result
    };
  } catch (error) {
    console.error('Error invoking video merge Lambda:', error);
    return { success: false, error: error.message };
  }
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // Process S3 event
    const s3Event = event.Records[0].s3;
    const bucketName = s3Event.bucket.name;
    const fileKey = decodeURIComponent(s3Event.object.key);
    
    console.log(`Processing file: ${fileKey} from bucket: ${bucketName}`);

    // Parse filename to extract room name and timestamp
    const fileInfo = parseFileName(fileKey);
    if (!fileInfo.parsed) {
      console.log(`Could not parse filename: ${fileKey}`);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'File name could not be parsed' })
      };
    }

    const { roomName, timestamp, fileType } = fileInfo;
    console.log(`Parsed file info:`, { roomName, timestamp, fileType });

    // Add file record to DynamoDB
    const recordAdded = await addFileRecord(roomName, timestamp, fileType, fileKey);
    if (!recordAdded) {
      throw new Error('Failed to add file record to DynamoDB');
    }

    // Find matching file for the same room within time window
    const timeWindowMinutes = parseInt(process.env.TIME_WINDOW_MINUTES || '15');
    const matchingFile = await findMatchingFile(roomName, timestamp, fileType, timeWindowMinutes);

    if (matchingFile) {
      console.log(`Found matching file:`, matchingFile);
      
      // Determine which is main and which is translator
      let mainVideoKey, translatorVideoKey;
      if (fileType === 'main') {
        mainVideoKey = fileKey;
        translatorVideoKey = matchingFile.fileKey;
      } else {
        mainVideoKey = matchingFile.fileKey;
        translatorVideoKey = fileKey;
      }

      // Trigger video merge via existing Lambda
      const mergeResult = await triggerVideoMerge(mainVideoKey, translatorVideoKey, roomName);
      
      if (mergeResult.success) {
        console.log('Video merge triggered successfully');
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: 'File processed and video merge triggered',
            roomName: roomName,
            mainVideoKey: mainVideoKey,
            translatorVideoKey: translatorVideoKey,
            mergeTriggered: true
          })
        };
      } else {
        throw new Error(`Failed to trigger video merge: ${mergeResult.error}`);
      }
    } else {
      console.log(`No matching file found for room ${roomName} within ${timeWindowMinutes} minutes`);
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'File processed and recorded, waiting for matching file',
          roomName: roomName,
          fileType: fileType,
          timestamp: timestamp
        })
      };
    }

  } catch (error) {
    console.error('Error processing file:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error processing file',
        error: error.message
      })
    };
  }
}; 