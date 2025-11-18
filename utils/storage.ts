import { supabase } from '../lib/supabase';

/**
 * Upload an image to Supabase storage
 * @param uri - Local file URI from image picker or camera
 * @param bucket - Storage bucket name (e.g., 'license-photos', 'sep-selfies')
 * @param path - File path within the bucket (e.g., 'userId/license.jpg')
 * @returns Public URL of the uploaded image
 */
export async function uploadImage(
  uri: string,
  bucket: string,
  path: string
): Promise<string> {
  try {
    // Fetch the image as a blob
    const response = await fetch(uri);
    
    if (!response.ok) {
      throw new Error('Failed to read image file. Please select a different image.');
    }
    
    const blob = await response.blob();
    
    // Validate blob size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (blob.size > maxSize) {
      throw new Error('Image file is too large. Please select an image smaller than 10MB.');
    }
    
    // Convert blob to array buffer
    const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(new Error('Failed to process image file.'));
      reader.readAsArrayBuffer(blob);
    });

    // Determine content type from URI or default to jpeg
    const extension = uri.match(/\.(jpg|jpeg|png|gif)$/i)?.[1]?.toLowerCase();
    let contentType = 'image/jpeg'; // Default
    
    if (extension === 'png') {
      contentType = 'image/png';
    } else if (extension === 'gif') {
      contentType = 'image/gif';
    } else if (extension === 'jpg' || extension === 'jpeg') {
      contentType = 'image/jpeg';
    }

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, arrayBuffer, {
        contentType,
        upsert: true, // Replace if file already exists
      });

    if (error) {
      console.error('Supabase storage error:', error);
      
      // Provide specific error messages based on error type
      if (error.message.includes('not found')) {
        throw new Error('Storage configuration error. Please contact support.');
      } else if (error.message.includes('unauthorized') || error.message.includes('permission')) {
        throw new Error('Permission denied. Please contact support.');
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        throw new Error('Network error. Please check your connection and try again.');
      } else {
        throw new Error(`Upload failed: ${error.message}`);
      }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    if (!urlData?.publicUrl) {
      throw new Error('Failed to generate image URL. Please try again.');
    }

    return urlData.publicUrl;
  } catch (error: any) {
    console.error('Error uploading image:', error);
    
    // Re-throw with original message if it's already a custom error
    if (error.message && error.message.includes('Please')) {
      throw error;
    }
    
    // Generic fallback error
    throw new Error('Failed to upload image. Please check your connection and try again.');
  }
}

/**
 * Upload audio to Supabase storage
 * @param uri - Local file URI from audio recording
 * @param bucket - Storage bucket name (e.g., 'sep-audio')
 * @param path - File path within the bucket
 * @returns Public URL of the uploaded audio
 */
export async function uploadAudio(
  uri: string,
  bucket: string,
  path: string
): Promise<string> {
  try {
    // Fetch the audio file as a blob
    const response = await fetch(uri);
    const blob = await response.blob();
    
    // Convert blob to array buffer
    const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });

    // Determine content type - use supported MIME types
    // Supabase supports audio/mpeg, audio/wav, audio/mp4, etc.
    let contentType = 'audio/mp4'; // Default for m4a files
    
    const extension = uri.match(/\.(m4a|mp3|wav)$/i)?.[1]?.toLowerCase();
    if (extension === 'mp3') {
      contentType = 'audio/mpeg';
    } else if (extension === 'wav') {
      contentType = 'audio/wav';
    } else if (extension === 'm4a') {
      contentType = 'audio/mp4'; // m4a is actually MPEG-4 audio
    }

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, arrayBuffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading audio:', error);
    throw new Error('Failed to upload audio. Please try again.');
  }
}
