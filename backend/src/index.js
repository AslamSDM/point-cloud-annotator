import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
  ScanCommand,
  UpdateCommand
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

// Validate required environment variables
if (!process.env.ANNOTATIONS_TABLE) {
  throw new Error('ANNOTATIONS_TABLE environment variable is required');
}
if (!process.env.POINT_CLOUDS_TABLE) {
  throw new Error('POINT_CLOUDS_TABLE environment variable is required');
}

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.ANNOTATIONS_TABLE;
const POINT_CLOUDS_TABLE = process.env.POINT_CLOUDS_TABLE;

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Helper function to create response
const response = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  },
  body: JSON.stringify(body)
});

// Get all annotations (optionally filtered by pointCloudId)
async function getAnnotations(pointCloudId = null) {
  let command;
  
  if (pointCloudId) {
    // Filter by pointCloudId using a scan with filter expression
    command = new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'pointCloudId = :pcId',
      ExpressionAttributeValues: {
        ':pcId': pointCloudId
      }
    });
  } else {
    command = new ScanCommand({
      TableName: TABLE_NAME
    });
  }

  const result = await docClient.send(command);
  return response(200, result.Items || []);
}

// Create a new annotation
async function createAnnotation(body) {
  let data;
  try {
    data = JSON.parse(body);
  } catch (e) {
    return response(400, { error: 'Invalid JSON body' });
  }

  // Validate position
  if (!data.position ||
      typeof data.position.x !== 'number' ||
      typeof data.position.y !== 'number' ||
      typeof data.position.z !== 'number') {
    return response(400, { error: 'Invalid position coordinates' });
  }

  // Validate text length (max 256 bytes)
  const text = data.text || '';
  if (Buffer.byteLength(text, 'utf8') > 256) {
    return response(400, { error: 'Text exceeds 256 bytes limit' });
  }

  const annotation = {
    id: randomUUID(),
    pointCloudId: data.pointCloudId || null,
    position: {
      x: data.position.x,
      y: data.position.y,
      z: data.position.z
    },
    text: text,
    cameraPosition: data.cameraPosition || null,
    cameraTarget: data.cameraTarget || null,
    createdAt: new Date().toISOString()
  };

  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: annotation
  });

  await docClient.send(command);
  return response(201, annotation);
}

// Update an annotation
async function updateAnnotation(id, body) {
  let data;
  try {
    data = JSON.parse(body);
  } catch (e) {
    return response(400, { error: 'Invalid JSON body' });
  }

  // Validate text length (max 256 bytes)
  if (data.text && Buffer.byteLength(data.text, 'utf8') > 256) {
    return response(400, { error: 'Text exceeds 256 bytes limit' });
  }

  const command = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { id },
    UpdateExpression: 'SET #text = :text, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#text': 'text'
    },
    ExpressionAttributeValues: {
      ':text': data.text || '',
      ':updatedAt': new Date().toISOString()
    },
    ReturnValues: 'ALL_NEW'
  });

  try {
    const result = await docClient.send(command);
    return response(200, result.Attributes);
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      return response(404, { error: 'Annotation not found' });
    }
    throw error;
  }
}

// Delete an annotation
async function deleteAnnotation(id) {
  const command = new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { id },
    ConditionExpression: 'attribute_exists(id)'
  });

  try {
    await docClient.send(command);
    return response(204, null);
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      return response(404, { error: 'Annotation not found' });
    }
    throw error;
  }
}

// ========================================
// Point Cloud CRUD Operations
// ========================================

// Get all point clouds
async function getPointClouds() {
  const command = new ScanCommand({
    TableName: POINT_CLOUDS_TABLE
  });

  const result = await docClient.send(command);
  return response(200, result.Items || []);
}

// Create a new point cloud entry
async function createPointCloud(body) {
  let data;
  try {
    data = JSON.parse(body);
  } catch (e) {
    return response(400, { error: 'Invalid JSON body' });
  }

  // Validate required fields
  if (!data.name || typeof data.name !== 'string') {
    return response(400, { error: 'Name is required' });
  }
  if (!data.path || typeof data.path !== 'string') {
    return response(400, { error: 'Path is required' });
  }

  // Normalize path (ensure trailing slash)
  let path = data.path.trim();
  if (!path.endsWith('/')) {
    path += '/';
  }

  const pointCloud = {
    id: randomUUID(),
    name: data.name.trim(),
    path: path,
    createdAt: new Date().toISOString()
  };

  const command = new PutCommand({
    TableName: POINT_CLOUDS_TABLE,
    Item: pointCloud
  });

  await docClient.send(command);
  return response(201, pointCloud);
}

// Delete a point cloud entry
async function deletePointCloud(id) {
  const command = new DeleteCommand({
    TableName: POINT_CLOUDS_TABLE,
    Key: { id },
    ConditionExpression: 'attribute_exists(id)'
  });

  try {
    await docClient.send(command);
    return response(204, null);
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      return response(404, { error: 'Point cloud not found' });
    }
    throw error;
  }
}

// Main handler
export const handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const { routeKey, pathParameters, body, queryStringParameters } = event;
  
  // HTTP API v2 uses routeKey format: "GET /annotations"
  // Fall back to requestContext.http for direct invocations
  const method = routeKey?.split(' ')[0] || event.requestContext?.http?.method;
  const path = routeKey?.split(' ')[1] || event.requestContext?.http?.path;
  
  console.log('Parsed route:', { method, path, routeKey });

  try {
    // Handle based on route - use routeKey for exact matching when available
    if (routeKey === 'GET /annotations' || (method === 'GET' && path === '/annotations')) {
      const pointCloudId = queryStringParameters?.pointCloudId || null;
      return await getAnnotations(pointCloudId);
    }

    if (routeKey === 'POST /annotations' || (method === 'POST' && path === '/annotations')) {
      return await createAnnotation(body);
    }

    if (routeKey?.startsWith('PUT /annotations/') || (method === 'PUT' && path?.startsWith('/annotations/'))) {
      const id = pathParameters?.id;
      if (!id) {
        return response(400, { error: 'Annotation ID required' });
      }
      if (!UUID_REGEX.test(id)) {
        return response(400, { error: 'Invalid annotation ID format' });
      }
      return await updateAnnotation(id, body);
    }

    if (routeKey?.startsWith('DELETE /annotations/') || (method === 'DELETE' && path?.startsWith('/annotations/'))) {
      const id = pathParameters?.id;
      if (!id) {
        return response(400, { error: 'Annotation ID required' });
      }
      if (!UUID_REGEX.test(id)) {
        return response(400, { error: 'Invalid annotation ID format' });
      }
      return await deleteAnnotation(id);
    }

    // Point Cloud routes
    if (routeKey === 'GET /pointclouds' || (method === 'GET' && path === '/pointclouds')) {
      return await getPointClouds();
    }

    if (routeKey === 'POST /pointclouds' || (method === 'POST' && path === '/pointclouds')) {
      return await createPointCloud(body);
    }

    if (routeKey?.startsWith('DELETE /pointclouds/') || (method === 'DELETE' && path?.startsWith('/pointclouds/'))) {
      const id = pathParameters?.id;
      if (!id) {
        return response(400, { error: 'Point cloud ID required' });
      }
      if (!UUID_REGEX.test(id)) {
        return response(400, { error: 'Invalid point cloud ID format' });
      }
      return await deletePointCloud(id);
    }

    console.log('No route matched for:', { routeKey, method, path });
    return response(404, { error: 'Not found' });
  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: 'Internal server error' });
  }
};
