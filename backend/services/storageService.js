const supabase = require('../db');
const path = require('path');
const { SUPABASE_STORAGE_BUCKET } = require('../config/env');

const uploadImageToStorage = async (file, userId) => {
    if (!file) return null;
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const filePath = `${userId || 'anon'}/${safeName}${ext}`;

    const { data, error } = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .upload(filePath, file.buffer, {
            contentType: file.mimetype || 'application/octet-stream',
            upsert: false,
        });

    if (error) {
        throw error;
    }

    const { data: publicData } = supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .getPublicUrl(data.path);

    return {
        fileId: data.path,
        publicUrl: publicData?.publicUrl || null,
    };
};

module.exports = {
    uploadImageToStorage,
};
