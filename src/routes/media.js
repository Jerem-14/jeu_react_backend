import { uploadMedia, getMedia, deleteMedia } from '../controllers/media.js';
import fastifyMultipart from '@fastify/multipart';
export function mediaRoutes(app) {
    // Register multipart support for file uploads
    app.register(fastifyMultipart, {
        limits: {
            fieldSize: 50 * 1024 * 1024 // 50MB
        }
    });

    app.post('/api/media', {
        handler: uploadMedia,
        schema: {
            description: 'Upload media file',
            tags: ['media'],
            summary: 'Upload new media',
            consumes: ['multipart/form-data'],
            response: {
                201: {
                    description: 'Successful response',
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        type: { type: 'string' },
                        url: { type: 'string' },
                        filename: { type: 'string' },
                        format: { type: 'string' },
                        tags: { type: 'array', items: { type: 'string' } }
                    }
                }
            }
        }
    });

    app.get('/api/media', {
        handler: getMedia,
        schema: {
            description: 'Get media files',
            tags: ['media'],
            summary: 'Get media files with optional filters',
            querystring: {
                type: 'object',
                properties: {
                    type: { type: 'string', enum: ['all', 'image', 'video'] },
                    tags: { type: 'string' }
                }
            }
        }
    });

    app.delete('/api/media/:id', {
        handler: deleteMedia,
        schema: {
            description: 'Delete media file',
            tags: ['media'],
            summary: 'Delete media by ID',
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' }
                },
                required: ['id']
            }
        }
    });
};