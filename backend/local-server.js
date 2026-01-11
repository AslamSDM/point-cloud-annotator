/**
 * Local development server that mimics AWS Lambda + API Gateway behavior.
 * Uses a local JSON file instead of DynamoDB for storage.
 * Run this for local development without needing to deploy to AWS.
 */

import express from 'express';
import cors from 'cors';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Middleware
app.use(cors());
app.use(express.json());

// Database setup (local JSON file)
const dbFile = join(__dirname, 'db.json');
const adapter = new JSONFile(dbFile);
const defaultData = { annotations: [] };
const db = new Low(adapter, defaultData);

// Initialize database
await db.read();
db.data ||= defaultData;
await db.write();

// GET all annotations
app.get('/annotations', async (req, res) => {
  try {
    await db.read();
    res.json(db.data.annotations);
  } catch (error) {
    console.error('Error fetching annotations:', error);
    res.status(500).json({ error: 'Failed to fetch annotations' });
  }
});

// POST create new annotation
app.post('/annotations', async (req, res) => {
  try {
    const { position, text, cameraPosition, cameraTarget } = req.body;

    // Validate required fields
    if (!position || typeof position.x !== 'number' ||
        typeof position.y !== 'number' || typeof position.z !== 'number') {
      return res.status(400).json({ error: 'Invalid position coordinates' });
    }

    // Validate text length (max 256 bytes)
    const textValue = text || '';
    if (Buffer.byteLength(textValue, 'utf8') > 256) {
      return res.status(400).json({ error: 'Text exceeds 256 bytes limit' });
    }

    const annotation = {
      id: randomUUID(),
      position: {
        x: position.x,
        y: position.y,
        z: position.z
      },
      text: textValue,
      cameraPosition: cameraPosition || null,
      cameraTarget: cameraTarget || null,
      createdAt: new Date().toISOString()
    };

    await db.read();
    db.data.annotations.push(annotation);
    await db.write();

    res.status(201).json(annotation);
  } catch (error) {
    console.error('Error creating annotation:', error);
    res.status(500).json({ error: 'Failed to create annotation' });
  }
});

// PUT update annotation
app.put('/annotations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid annotation ID format' });
    }

    // Validate text length (max 256 bytes)
    if (text && Buffer.byteLength(text, 'utf8') > 256) {
      return res.status(400).json({ error: 'Text exceeds 256 bytes limit' });
    }

    await db.read();
    const index = db.data.annotations.findIndex(a => a.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    db.data.annotations[index] = {
      ...db.data.annotations[index],
      text: text !== undefined ? text : db.data.annotations[index].text,
      updatedAt: new Date().toISOString()
    };

    await db.write();
    res.json(db.data.annotations[index]);
  } catch (error) {
    console.error('Error updating annotation:', error);
    res.status(500).json({ error: 'Failed to update annotation' });
  }
});

// DELETE annotation
app.delete('/annotations/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid annotation ID format' });
    }

    await db.read();
    const index = db.data.annotations.findIndex(a => a.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    db.data.annotations.splice(index, 1);
    await db.write();

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting annotation:', error);
    res.status(500).json({ error: 'Failed to delete annotation' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Local development server running on http://localhost:${PORT}`);
  console.log('This server mimics AWS Lambda + API Gateway behavior');
});
