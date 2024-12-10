import Media from '../models/media.js';
import fs from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = './uploads';

// Ensure upload directory exists
await fs.mkdir(UPLOAD_DIR, { recursive: true });

export const uploadMedia = async (request, reply) => {
    try {
        const data = await request.file();
        if (!data) return reply.code(400).send({ error: 'No file uploaded' });

        // Save file
        const filePath = path.join(UPLOAD_DIR, data.filename);
        await fs.writeFile(filePath, await data.toBuffer());

        const tags = data.fields?.tags?.value?.split(',').filter(Boolean) || [];
        
        const media = await Media.create({
            type: data.mimetype.startsWith('image/') ? 'image' : 'video',
            url: `/uploads/${data.filename}`,
            filename: data.filename,
            format: data.mimetype.split('/')[1],
            tags
        });

        return reply.code(201).send(media);
    } catch (error) {
        console.error('Upload error:', error);
        return reply.code(500).send({ error: error.message });
    }
};
export const getMedia = async (request, reply) => {
    try {
        const { type, tags } = request.query;
        let where = {};
        
        if (type && type !== 'all') {
            where.type = type;
        }
        
        if (tags) {
            where.tags = { [Op.contains]: tags.split(',') };
        }

        const media = await Media.findAll({ where });
        return reply.send(media);
    } catch (error) {
        return reply.code(500).send({ error: error.message });
    }
};

export const deleteMedia = async (request, reply) => {
    try {
        const { id } = request.params;
        const media = await Media.findByPk(id);
        
        if (!media) {
            return reply.code(404).send({ error: 'Media not found' });
        }

        await media.destroy();
        return reply.send({ message: 'Media deleted successfully' });
    } catch (error) {
        return reply.code(500).send({ error: error.message });
    }
};