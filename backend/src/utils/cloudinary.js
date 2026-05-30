import { v2 as cloudinary } from 'cloudinary'

// Configure Cloudinary SDK with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

/**
 * Upload a PDF Buffer to Cloudinary under raw resources.
 * 
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string} folder - Folder hierarchy (invoices/{companyId}/{year}/{month}/)
 * @param {string} filename - Specific public id filename
 * @returns {Promise<{ url: string, publicId: string }>}
 */
const uploadPDF = (pdfBuffer, folder, filename) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'raw',
        public_id: filename,
      },
      (error, result) => {
        if (error) {
          console.error('[Cloudinary Utility] Upload failed:', error.message)
          return reject(error)
        }
        resolve({
          url: result.secure_url || result.url,
          publicId: result.public_id,
        })
      }
    )
    uploadStream.end(pdfBuffer)
  })
}

/**
 * Delete a raw file from Cloudinary.
 * 
 * @param {string} publicId - The public ID of the resource to delete
 * @returns {Promise<Object>}
 */
const deleteFile = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'raw',
    })
    return result
  } catch (error) {
    console.error('[Cloudinary Utility] Delete failed:', error.message)
    throw error
  }
}

/**
 * Generate a temporary signed secure URL for raw resources.
 * 
 * @param {string} publicId - The public ID of the resource
 * @returns {string} The signed URL
 */
const getSignedUrl = (publicId) => {
  // Generates a temporary signed URL valid for raw resources
  return cloudinary.url(publicId, {
    sign_url: true,
    resource_type: 'raw',
    secure: true,
  })
}

export { uploadPDF, deleteFile, getSignedUrl }
