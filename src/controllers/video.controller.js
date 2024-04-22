import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary , destroyFromCloudinary} from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    //TODO: get all videos based on query, sort, pagination
})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body
    
    if(!title && !description){
        throw new ApiError(401 , "All fields are required")
    }

    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path
    const videoFileLocalPath = req.files?.videoFile?.[0]?.path

    if(!thumbnailLocalPath){
        throw new ApiError(401 , "Thumbnail not found")
    }

    if(!videoFileLocalPath){
        throw new ApiError(401 , "Video file not found")
    }

    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)
    const videoFile = await uploadOnCloudinary(videoFileLocalPath)

    if(!thumbnail){
        throw new ApiError(400 , "Thumbnail not found")
    }

    if(!videoFile){
        throw new ApiError(401 , "Video file not found")
    }

    const video = await Video.create({
        title , 
        description ,
        videoFile : videoFile.url ,
        thumbnail : thumbnail.url ,
        duration : videoFile.duration ,
        isPublished : false ,
        owner : req.user._id
    })

    const uploadedVideo = await Video.findById(video._id)

    if(!uploadedVideo){
        throw new ApiError(500 , "Video upload failed , please try again")
    }

    return res.status(200).json(new ApiResponse(200 , video , "Video Uploaded Successfully"))

})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const isValidVideo = isValidObjectId(videoId)

    if(!isValidVideo){
        throw new ApiError(400 , "Video Id is invalid")
    }

    const videoData = await Video.findById(videoId)

    if(!videoData){
        throw new ApiError(404 , "Video Doesn't Exist")
    }

    if(!videoData.owner.equals(req.user?._id)){
        throw new ApiError(400 , "You are not the owner")
    }

    const {title , description} = req.body

    if(!title && !description){
        throw new ApiError(401 , "All fields are required")
    }

    const thumbnailLocalPath = req.file?.path

    if(!thumbnailLocalPath){
        throw new ApiError(401 , "Thumbnail is required")
    }
    const thumbnailToDelete = videoData.thumbnail
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)

    const video = await Video.findByIdAndUpdate(
        videoId , 
        {
            $set: {
                title , 
                description,
                thumbnail : thumbnail.url
            }
        } , {
            new : true
        }
    )

    if(!video){
        throw new ApiError(500 , "Failed to Update Data")
    }

    if(video){
        await destroyFromCloudinary(thumbnailToDelete)
    }

    res.status(200).json(
        new ApiResponse(200, video , "Items Updated Successfully")
    )
})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    const isValid = isValidObjectId(videoId)

    if(!isValid){
        throw new ApiError(400 , "Invalid Object ID")
    }

    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(404 , "Video Not Found")
    }

    if(!video.owner.equals(req.user?._id)){
        throw new ApiError(400 , "You are not the owner")
    }

    await destroyFromCloudinary(video.thumbnail)
    await destroyFromCloudinary(video.videoFile)

    const deletedVideo = await Video.deleteOne({ _id : videoId })

    return res.status(200).json(
        new ApiResponse(200 , deletedVideo , "Video Deleted Successfully")
    )

})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    const isValid = isValidObjectId(videoId)

    if(!isValid){
        throw new ApiError(400 , "Invalid Object ID")
    }

    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(404 , "Video Not Found")
    }

    if(!video.owner.equals(req.user._id)){
        throw new ApiError(400 , "You are not the owner")
    }

    video.isPublished = !video.isPublished
    await video.save({validateBeforeSave: false})

    return res.status(200).json(
        new ApiResponse(200 , video , "Publish Status Toggled")
    )
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}