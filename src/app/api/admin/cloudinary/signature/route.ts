import { NextRequest } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { verifyAdmin } from "@/lib/admin-auth";
import { ok, err, serverError } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  const authResult = await verifyAdmin(req);
  if (!authResult.authorized) return authResult.response;

  try {
    const { paramsToSign } = await req.json();

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET!
    );

    return ok({ 
      signature, 
      apiKey: process.env.CLOUDINARY_API_KEY, 
      cloudName: process.env.CLOUDINARY_CLOUD_NAME 
    });
  } catch (error) {
    console.error("[Cloudinary Signature]", error);
    return serverError("Failed to generate signature");
  }
}
