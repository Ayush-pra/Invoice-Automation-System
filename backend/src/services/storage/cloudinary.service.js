import { v2 as cloudinary } from 'cloudinary';
import config from '../../config/index.js';
import StorageService from './storage.service.js';

/**
 * Cloudinary implementation of StorageService.
 * Handles PDF uploads organized by user and vendor.
 */
class CloudinaryService extends StorageService {
  constructor() {
    super();
    cloudinary.config({
      cloud_name: config.cloudinary.cloudName,
      api_key: config.cloudinary.apiKey,
      api_secret: config.cloudinary.apiSecret,
    });
  }

  /**
   * Sanitizes a string for use as a Cloudinary folder name.
   */
  _sanitizeFolderName(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Upload a file buffer to Cloudinary.
   * Files are organized as: invoices/{userId}/{vendorName}/{fileName}
   */
  async uploadFile(fileBuffer, options = {}) {
    const { userId, vendorName = 'unknown', fileName = 'invoice' } = options;

    const sanitizedVendor = this._sanitizeFolderName(vendorName);
    const folder = `invoices/${userId}/${sanitizedVendor}`;

    // Strip extension from fileName for public_id
    const baseName = fileName.replace(/\.[^.]+$/, '');

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw', // PDFs are raw files, not images
          folder,
          public_id: `${baseName}_${Date.now()}`,
          format: 'pdf',
        },
        (error, result) => {
          if (error) {
            reject(new Error(`Cloudinary upload failed: ${error.message}`));
          } else {
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
            });
          }
        }
      );

      uploadStream.end(fileBuffer);
    });
  }

  /**
   * Delete a file from Cloudinary by its public ID.
   */
  async deleteFile(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'raw',
      });
      return { success: result.result === 'ok' };
    } catch (error) {
      throw new Error(`Cloudinary delete failed: ${error.message}`);
    }
  }

  /**
   * Get the public URL for a Cloudinary resource.
   */
  getFileUrl(publicId) {
    return cloudinary.url(publicId, {
      resource_type: 'raw',
      secure: true,
    });
  }
}

export default CloudinaryService;
