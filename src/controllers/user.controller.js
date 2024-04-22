import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary , destroyFromCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js" 
import jwt from "jsonwebtoken"
import mongoose from "mongoose"

const generateAccessAndRefreshToken = async(userid) => {

    try {
        const user = await User.findById(userid)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return { accessToken , refreshToken }
    } catch (error) {
        throw new ApiError(500 , "Something went wrong while generating access and refresh token")
    }

}

const registerUser = asyncHandler( async (req,res) => {
    const {fullname , username , email ,password} = req.body
    // console.log("email :" , email , "password :" , password)

    if( 
        [fullname , username , email , password].some((field) => field?.trim === "")
     ){
        throw new ApiError(400 , "All fields are required")
    }

    const existedUser = await User.findOne({
        //$or => operator 
        $or: [{ username } , { password }] 
    })

    if(existedUser){
        throw new ApiError(409 , "User with email or username already exists")
    }

    // console.log(req.files)  
    const avatarLocalPath = req.files?.avatar[0]?.path                //the .files is provided by the multer middleware
    // const coverImageLocalPath = req.files?.coverImage[0]?.path

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }
    //isArray checks if it has an array

    if(!avatarLocalPath){
        throw new ApiError(409 , "Avatar is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(409 , "Avatar is required")
    }

    const user = await User.create({
        fullname,
        username: username.toLowerCase(),
        password,
        email,
        avatar: avatar.url,
        coverImage: coverImage?.url || ""
    })

    const createdUser = await User.findById(user._id).select("-password -refreshToken")

    if(!createdUser){
        throw new ApiError(500 , "Something went wrong while Registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200 , createdUser , "User registered Successfully")
    )

} )

const loginUser = asyncHandler( async (req,res) => {

    const { email , username , password } = req.body

    if(!(username || email)){
        throw new ApiError(400 , "username or email is required")
    }

    const user = await User.findOne({  //your custom methods will be available at user not Userghgfvcvc
        $or: [{email} , {username}]
    })

    if(!user){
        throw new ApiError(404 , "User does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401 , "Invalid User Credentials")
    }

    const {accessToken , refreshToken} = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .cookie("refreshToken" , refreshToken , options)
    .cookie("accessToken" , accessToken , options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser , refreshToken , accessToken
            },
            "User Logged In Successfully"
        )
    )

} )

const logoutUser = asyncHandler( async (req,res) => {
    await User.findByIdAndUpdate(
        req.user._id , 
        {
            $unset: {
                refreshToken : 1
            }
        } , {
            new : true
        }
    )
        const options = {
            httpOnly: true,
            secure: true
        } 

        return res.status(200).clearCookie("refreshToken" , options)
        .clearCookie("accessToken" , options).json(
            new ApiResponse(200 , {} , "User logged out Successfully")
        )

} )

const refreshAccessToken = asyncHandler( async (req,res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401 , "Unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken , process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401 , "Invalid Refresh Token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401 , "Refresh token is expired or used")
        }
    
        const {accessToken , refreshToken} = await generateAccessAndRefreshToken(user._id)
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        return res.status(200).cookie("accessToken" , accessToken , options)
        .cookie("refreshToken" , refreshToken , options).json(
            new ApiResponse(
                200,
                {accessToken , refreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401 , error?.message || "Invalid refresh token")
    }
})

const changeCurrentPassword = asyncHandler( async(req,res) => {
    const {oldPassword , newPassword} = req.body

    const user = await User.findById(req.user?._id)

    const isOldPasswordValid = await user.isPasswordCorrect(oldPassword)

    if(!isOldPasswordValid){
        throw new ApiError(401 , "Old Password Incorrect")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res.status(200)
    .json(
        new ApiResponse(
            200 , {} , "Password Changed successfully"
        )
    )
})

const getCurrentUser = asyncHandler( async(req,res) => {
    return res.status(200)
    .json(
        new ApiResponse(200 , req.user , "User fetched successfully")
    )
} )

const updateAccountDetails = asyncHandler( async(req,res) => {
    const {fullname , email} = req.body

    if(!fullname || !email) {
        throw new ApiError(401 , "All fields are required")
    }

    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullname,
                email
            }
        }, {
            new: true   //returns after update information
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200 , user , "Account Details Updated successfully")
    )
})

const updateAvatar = asyncHandler( async(req,res) => {
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400 , "Avatar file missing")
    }

    const initUser = await User.findById(req.user._id)
    destroyFromCloudinary(initUser.avatar)

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiResponse(400 , "Error whlie uploading avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                avatar: avatar.url
            }
        }, {
            new: true
        }
    ).select("-password")

    return res.status(200)
    .json(new ApiResponse(
        200 , user , "Avatar updated successfully"
    ))
})

const updateCoverImage = asyncHandler( async(req,res) => {
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400 , "cover image file missing")
    }

    const initUser = await User.findById(req.user._id)
    const oldCoverImageId = initUser.coverImage.split('/').pop().split('.')[0]
    destroyFromCloudinary(oldCoverImageId)

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiResponse(400 , "Error whlie uploading Cover image")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        }, {
            new: true
        }
    ).select("-password")

    return res.status(200)
    .json(new ApiResponse(
        200 , user , "cover image updated successfully"
    ))
})

const getUserChannelProfile = asyncHandler( async(req,res) => {
    const {username} = req.params

    if(!username?.trim()){
        throw new ApiError(400 , "username is missing")
    }

    const channel = await  User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            } 
        } , {
            $lookup: {
                from: "subscriptions",
                foreignField: "channel",
                localField: "_id",
                as: "subscribers"
            }
        }, {
            $lookup: {
                from: "subscriptions",
                foreignField: "subscriber",
                localField: "_id",
                as: "subscribedTo"
            }
        } , {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                } , 
                channelsSubscribedTo: {
                    $size: "$subscribedTo"
                } , 
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id , "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        }, {
            $project: {
                fullname: 1,
                username: 1,
                email: 1,
                avatar: 1,
                coverImage: 1,
                subscribersCount: 1,
                channelsSubscribedTo: 1,
                isSubscribed: 1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404, "Channel does not exist")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200 , channel[0] , "Channel fetched successfully")
    )

} )

const getWatchHistory = asyncHandler( async(req,res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        }, {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project:{
                                        fullname: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    } ,{
                        $addFields:{
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ] 
            }
        }
    ])

    return res.status(200)
    .json(
        new ApiResponse(200 , user[0].watchHistory , "Watch history fetched successfully")
    )
})

export {
    registerUser ,
    loginUser ,
    logoutUser ,
    refreshAccessToken ,
    changeCurrentPassword ,
    getCurrentUser,
    updateAccountDetails ,
    updateAvatar ,
    updateCoverImage ,
    getUserChannelProfile ,
    getWatchHistory
}