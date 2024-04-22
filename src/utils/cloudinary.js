import {v2 as cloudinary} from "cloudinary"
import fs from "fs"
          
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null
        //upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })
        // file has been uploaded successfull
        // console.log("file is uploaded on cloudinary ", response);
        fs.unlinkSync(localFilePath)
        return response;

    } catch (error) {
        fs.unlinkSync(localFilePath) // remove the locally saved temporary file as the upload operation got failed
        return null;
    }
}

const destroyFromCloudinary = async (cloudinaryFileURL) => {
    try {
        const cloudinaryFileId = cloudinaryFileURL.split('/').pop().split('.')[0]
        const resourceType = cloudinaryFileURL.endsWith('.mp4') ? 'video' : 'image';
        const result = await cloudinary.uploader.destroy(cloudinaryFileId, { resource_type: resourceType });
        return result
    } catch (error) {
        return null
    }
}

export {uploadOnCloudinary , destroyFromCloudinary}
