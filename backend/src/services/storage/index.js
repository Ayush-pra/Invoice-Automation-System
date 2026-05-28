import CloudinaryService from './cloudinary.service.js';

/**
 * Storage service factory.
 * Returns the configured storage provider instance.
 * Currently uses Cloudinary. To switch to S3/R2/GCS,
 * just change the instantiation here.
 */
let storageInstance = null;

export function getStorageService() {
  if (!storageInstance) {
    storageInstance = new CloudinaryService();
  }
  return storageInstance;
}

export default getStorageService;
