import { v2 as cloudinary } from "cloudinary";

/**
 * Configure Cloudinary — server-side only.
 * Credentials never reach the browser.
 */
function configureCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}


/**
 * Upload a buffer directly to Cloudinary from the server (for admin testimonial uploads).
 */
export async function uploadVideoToCloudinary(
  buffer: Buffer,
  publicId: string,
  folder: string = "testimonials"
): Promise<{ publicId: string; secureUrl: string; thumbnailUrl: string }> {
  configureCloudinary();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "video",
        public_id: publicId,
        folder,
        overwrite: false,
        eager: [{ width: 640, height: 360, crop: "fill", format: "jpg" }], // Auto-thumbnail
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("No result from Cloudinary"));
        resolve({
          publicId: result.public_id,
          secureUrl: result.secure_url,
          thumbnailUrl:
            result.eager?.[0]?.secure_url ??
            result.secure_url.replace(/\.[^.]+$/, ".jpg"),
        });
      }
    );
    stream.end(buffer);
  });
}

/**
 * Upload a thumbnail image to Cloudinary.
 */
export async function uploadImageToCloudinary(
  buffer: Buffer,
  publicId: string,
  folder: string = "testimonials/thumbnails"
): Promise<{ secureUrl: string }> {
  configureCloudinary();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        public_id: publicId,
        folder,
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("No result from Cloudinary"));
        resolve({ secureUrl: result.secure_url });
      }
    );
    stream.end(buffer);
  });
}

