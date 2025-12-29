import { v2 as cloudinary } from 'cloudinary';

const cloudinaryConfig = process.env.CLOUDINARY_URL
    ? { cloudinary_url: process.env.CLOUDINARY_URL }
    : {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
    };

if (cloudinaryConfig) {
    cloudinary.config(cloudinaryConfig);
}

export default cloudinary;

// Get environment-specific folder prefix
export function getCloudinaryFolder(baseFolder: string): string {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const folderSuffix = isDevelopment ? '-demo' : '';
    return `${baseFolder}${folderSuffix}`;
}

export async function signUploadRequest(folder: string) {
    const timestamp = Math.round((new Date).getTime() / 1000);
    const apiSecret = cloudinary.config().api_secret || process.env.CLOUDINARY_API_SECRET;

    if (!apiSecret) {
        throw new Error("Cloudinary API Secret not found");
    }

    const envFolder = getCloudinaryFolder(folder);

    const signature = cloudinary.utils.api_sign_request({
        timestamp: timestamp,
        folder: envFolder,
    }, apiSecret);

    return { timestamp, signature, folder: envFolder };
}
