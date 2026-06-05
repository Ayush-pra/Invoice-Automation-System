/**
 * Abstract storage service.
 * All storage implementations must extend this class.
 * This ensures any storage provider (Cloudinary, S3, R2, GCS) can be swapped
 * without changing business logic.
 */
class StorageService {
  /**
   * Upload a file to storage.
   * @param {Buffer} fileBuffer - The file data as a buffer.
   * @param {Object} options - Upload options.
   * @param {string} options.userId - User ID for folder organization.
   * @param {string} [options.vendorName] - Vendor name for sub-folder organization.
   * @param {string} [options.fileName] - Original file name.
   * @param {string} [options.mimeType] - File MIME type.
   * @returns {Promise<{url: string, publicId: string}>} Upload result.
   */
  async uploadFile(fileBuffer, options) {
    throw new Error('uploadFile() must be implemented by storage provider');
  }

  /**
   * Delete a file from storage.
   * @param {string} publicId - The file's public identifier in storage.
   * @returns {Promise<{success: boolean}>} Deletion result.
   */
  async deleteFile(publicId) {
    throw new Error('deleteFile() must be implemented by storage provider');
  }

  /**
   * Get the public URL for a file.
   * @param {string} publicId - The file's public identifier in storage.
   * @returns {string} The file's public URL.
   */
  getFileUrl(publicId) {
    throw new Error('getFileUrl() must be implemented by storage provider');
  }
}

export default StorageService;
