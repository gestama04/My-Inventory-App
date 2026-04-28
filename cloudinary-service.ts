import { CLOUDINARY_CONFIG, CLOUDINARY_UPLOAD_URL } from './cloudinary-config'

export interface CloudinaryUploadResult {
  secure_url: string
  public_id: string
  width: number
  height: number
}

export const uploadImageToCloudinary = async (
  base64Image: string,
  folder: string = 'vitastreak'
): Promise<CloudinaryUploadResult> => {
  let base64Data = base64Image

  if (base64Data.includes('data:')) {
    base64Data = base64Data.split(',')[1]
  }

  const formData = new FormData()
  formData.append('file', `data:image/jpeg;base64,${base64Data}`)
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset)
  formData.append('folder', folder)

  const response = await fetch(CLOUDINARY_UPLOAD_URL, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Erro Cloudinary:', errorText)
    throw new Error(`Cloudinary upload failed: ${response.status}`)
  }

  const result = await response.json()

  return {
    secure_url: result.secure_url,
    public_id: result.public_id,
    width: result.width,
    height: result.height,
  }
}