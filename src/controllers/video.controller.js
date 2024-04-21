import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    //TODO: get all videos based on query, sort, pagination
})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body
    
    if(!(title || description)){
        throw new ApiError(401 , "All fields are required")
    }

    const thumbnailLocalPath = req.files?.thumbnail[0]?.path
    const videoFileLocalPath = req.files?.videoFile[0]?.path

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
    //TODO: update video details like title, description, thumbnail

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}