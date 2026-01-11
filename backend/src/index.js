import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  ScanCommand,
  UpdateCommand
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.ANNOTATIONS_TABLE;

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

// Get all annotations
async function getAnnotations() {
  const command = new ScanCommand({
    TableName: TABLE_NAME
  });

  const result = await docClient.send(command);
  return response(200, result.Items || []);
}

// Create a new annotation
async function createAnnotation(body) {
  const data = JSON.parse(body);

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
  const data = JSON.parse(body);

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
    Key: { id }
  });

  await docClient.send(command);
  return response(204, null);
}

// Main handler
export const handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const { routeKey, pathParameters, body } = event;
  
  // HTTP API v2 uses routeKey format: "GET /annotations"
  // Fall back to requestContext.http for direct invocations
  const method = routeKey?.split(' ')[0] || event.requestContext?.http?.method;
  const path = routeKey?.split(' ')[1] || event.requestContext?.http?.path;
  
  console.log('Parsed route:', { method, path, routeKey });

  try {
    // Handle based on route - use routeKey for exact matching when available
    if (routeKey === 'GET /annotations' || (method === 'GET' && path === '/annotations')) {
      return await getAnnotations();
    }

    if (routeKey === 'POST /annotations' || (method === 'POST' && path === '/annotations')) {
      return await createAnnotation(body);
    }

    if (routeKey?.startsWith('PUT /annotations/') || (method === 'PUT' && path?.startsWith('/annotations/'))) {
      const id = pathParameters?.id;
      if (!id) {
        return response(400, { error: 'Annotation ID required' });
      }
      return await updateAnnotation(id, body);
    }

    if (routeKey?.startsWith('DELETE /annotations/') || (method === 'DELETE' && path?.startsWith('/annotations/'))) {
      const id = pathParameters?.id;
      if (!id) {
        return response(400, { error: 'Annotation ID required' });
      }
      return await deleteAnnotation(id);
    }

    console.log('No route matched for:', { routeKey, method, path });
    return response(404, { error: 'Not found' });
  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: 'Internal server error' });
  }
};
