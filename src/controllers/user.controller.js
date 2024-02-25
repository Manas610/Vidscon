import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js" 

const registerUser = asyncHandler( async (req,res) => {
    const {fullname , username , email ,password} = req.body
    console.log("email :" , email , "password :" , password , req.body)

    if( 
        [fullname , username , email , password].some((field) => field?.trim === "")
     ){
        throw new ApiError(400 , "All fields are required")
    }

    const existedUser = User.findOne({
        $or: [{ username } , { password }] 
    })

    console.log(existedUser)

    if(existedUser){
        throw new ApiError(409 , "User with email or username already exists")
    }

    console.log(req.files)  
    const avatarLocalPath = req.files?.avatar[0]?.path                //the .files is provided by the multer middleware
    const coverImageLocalPath = req.files?.coverImage[0]?.path

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

export {registerUser}