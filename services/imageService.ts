import { storage } from '@/config/firebase';
import { deleteObject, getDownloadURL, ref, uploadString } from 'firebase/storage';

export class ImageService {
  /**
   * Upload a base64 image to Firebase Storage
   * @param base64Image - Base64 encoded image string
   * @param userId - User ID for organizing images
   * @param folder - Storage folder (e.g., 'profile-images')
   * @returns Download URL of the uploaded image
   */
  static async uploadBase64Image(
    base64Image: string,
    userId: string,
    folder: string = 'profile-images'
  ): Promise<string> {
    try {
      // Generate unique filename with timestamp
      const timestamp = Date.now();
      const filename = `${folder}/${userId}_${timestamp}.jpg`;
      
      // Create storage reference
      const storageRef = ref(storage, filename);

      // Extract base64 data (remove data:image/...;base64, prefix if present)
      const base64Data = base64Image.includes(',') 
        ? base64Image.split(',')[1] 
        : base64Image;

      // Upload image
      console.log('Uploading image to Firebase Storage...');
      await uploadString(storageRef, base64Data, 'base64', {
        contentType: 'image/jpeg',
      });

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);
      console.log('Image uploaded successfully:', downloadURL);

      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error('Failed to upload image');
    }
  }

  /**
   * Delete an image from Firebase Storage
   * @param imageUrl - Full download URL of the image to delete
   */
  static async deleteImage(imageUrl: string): Promise<void> {
    try {
      // Extract storage path from URL
      const baseUrl = `https://firebasestorage.googleapis.com/v0/b/${storage.app.options.storageBucket}/o/`;
      
      if (!imageUrl.startsWith(baseUrl)) {
        console.warn('Invalid Firebase Storage URL');
        return;
      }

      // Extract the file path
      const encodedPath = imageUrl.split(baseUrl)[1].split('?')[0];
      const filePath = decodeURIComponent(encodedPath);

      // Create reference and delete
      const storageRef = ref(storage, filePath);
      await deleteObject(storageRef);
      
      console.log('Image deleted successfully');
    } catch (error) {
      console.error('Error deleting image:', error);
      // Don't throw error - image might already be deleted
    }
  }

  /**
   * Update user profile image (upload new and delete old)
   * @param base64Image - New base64 encoded image
   * @param userId - User ID
   * @param oldImageUrl - URL of old image to delete (optional)
   * @returns Download URL of the new image
   */
  static async updateProfileImage(
    base64Image: string,
    userId: string,
    oldImageUrl?: string
  ): Promise<string> {
    try {
      // Upload new image
      const newImageUrl = await this.uploadBase64Image(base64Image, userId);

      // Delete old image if it exists
      if (oldImageUrl) {
        await this.deleteImage(oldImageUrl);
      }

      return newImageUrl;
    } catch (error) {
      console.error('Error updating profile image:', error);
      throw new Error('Failed to update profile image');
    }
  }

  /**
   * Validate base64 image string
   * @param base64String - Base64 string to validate
   * @returns true if valid, false otherwise
   */
  static isValidBase64Image(base64String: string): boolean {
    if (!base64String) return false;

    // Check if it's a valid base64 string
    const base64Pattern = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/;
    const isDataUrl = base64Pattern.test(base64String);

    // If it's a data URL, it's valid
    if (isDataUrl) return true;

    // If it's just base64 without the prefix, check if it's valid base64
    try {
      const cleanBase64 = base64String.includes(',') 
        ? base64String.split(',')[1] 
        : base64String;
      
      // Basic base64 validation
      return /^[A-Za-z0-9+/]+={0,2}$/.test(cleanBase64);
    } catch {
      return false;
    }
  }

  /**
   * Get image size from base64 string (approximate)
   * @param base64String - Base64 image string
   * @returns Size in bytes
   */
  static getBase64Size(base64String: string): number {
    const base64Data = base64String.includes(',') 
      ? base64String.split(',')[1] 
      : base64String;
    
    // Calculate size: (length * 3/4) - padding
    const padding = base64Data.endsWith('==') ? 2 : base64Data.endsWith('=') ? 1 : 0;
    return (base64Data.length * 3) / 4 - padding;
  }

  /**
   * Check if image size is within limit
   * @param base64String - Base64 image string
   * @param maxSizeMB - Maximum size in megabytes (default: 5MB)
   * @returns true if within limit, false otherwise
   */
  static isWithinSizeLimit(base64String: string, maxSizeMB: number = 5): boolean {
    const sizeInBytes = this.getBase64Size(base64String);
    const sizeInMB = sizeInBytes / (1024 * 1024);
    return sizeInMB <= maxSizeMB;
  }

  /**
   * Compress base64 image (basic quality reduction)
   * Note: For better compression, use a dedicated image library
   * @param base64Image - Base64 image string
   * @param quality - Quality (0-1, default: 0.7)
   * @returns Compressed base64 string
   */
  static async compressImage(base64Image: string, quality: number = 0.7): Promise<string> {
    // This is a placeholder - actual implementation would require
    // react-native-image-resizer or similar library
    console.warn('Image compression not implemented - returning original');
    return base64Image;
  }
}

