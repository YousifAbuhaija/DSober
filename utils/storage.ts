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
    const blob = await response.blob();
    
    // Convert blob to array buffer
    const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
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
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw new Error('Failed to upload image. Please try again.');
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

    // Determine content type
    const contentType = uri.match(/\.(m4a|mp3|wav)$/i)?.[0]
      ? `audio/${uri.match(/\.(m4a|mp3|wav)$/i)![1].toLowerCase()}`
      : 'audio/m4a';

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
