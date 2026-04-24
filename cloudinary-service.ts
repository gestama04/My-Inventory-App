import { CLOUDINARY_CONFIG, CLOUDINARY_UPLOAD_URL } from './cloudinary-config';
import * as FileSystem from 'expo-file-system';

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
}

export const uploadImageToCloudinary = async (
  base64Image: string,
  folder: string = 'inventory'
): Promise<CloudinaryUploadResult> => {
  try {
    console.log("Iniciando upload para Cloudinary...");
    
    // Remover data URL prefix se existir
    let base64Data = base64Image;
    if (base64Data.includes('data:')) {
      base64Data = base64Data.split(',')[1];
    }
    
    // Criar FormData para upload
    const formData = new FormData();
    formData.append('file', `data:image/jpeg;base64,${base64Data}`);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    formData.append('folder', folder);
    
    // Fazer upload
    const response = await fetch(CLOUDINARY_UPLOAD_URL, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro Cloudinary:', errorText);
      throw new Error(`Cloudinary upload failed: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Upload Cloudinary concluído:', result.secure_url);
    
    return {
      secure_url: result.secure_url,
      public_id: result.public_id,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    console.error("Erro ao fazer upload para Cloudinary:", error);
    throw error;
  }
};

export const deleteImageFromCloudinary = async (publicId: string): Promise<boolean> => {
  try {
    // Para delete, precisamos de autenticação assinada
    // Por agora, vamos apenas logar - em produção, usar Edge Function
    console.log('Cloudinary delete solicitado para:', publicId);
    // A imagem será "órfã" mas não causa problemas
    // Pode-se limpar periodicamente via Cloudinary Dashboard ou API admin
    return true;
  } catch (error) {
    console.error("Erro ao deletar imagem do Cloudinary:", error);
    return false;
  }
};

export const getCloudinaryUrl = (publicId: string, transformations?: string): string => {
  const baseUrl = `https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloudName}/image/upload`;
  if (transformations) {
    return `${baseUrl}/${transformations}/${publicId}`;
  }
  return `${baseUrl}/${publicId}`;
};

// Criar URL com transformações comuns
export const getOptimizedImageUrl = (publicId: string, width: number = 400): string => {
  return getCloudinaryUrl(publicId, `w_${width},c_scale,q_auto,f_auto`);
};

export const getThumbnailUrl = (publicId: string): string => {
  return getCloudinaryUrl(publicId, 'w_150,h_150,c_fill,q_auto,f_auto');
};
