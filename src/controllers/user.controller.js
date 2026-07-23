import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

// =============================================
// Generate Access & Refresh Tokens
// =============================================
const generateAccessAndRefereshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;

        await user.save({
            validateBeforeSave: false,
        });

        return {
            accessToken,
            refreshToken,
        };
    } catch (error) {
        throw new ApiError(
            500,
            "Something went wrong while generating access and refresh token"
        );
    }
};

// =============================================
// Register User
// =============================================
const registerUser = asyncHandler(async (req, res) => {
    // Get data from frontend
    const { fullName, email, username, password } = req.body;

    // Validation
    if (
        [fullName, email, username, password].some(
            (field) => field?.trim() === ""
        )
    ) {
        throw new ApiError(400, "All fields are required");
    }

    // Check existing user
    const existedUser = await User.findOne({
        $or: [{ email }, { username }],
    });

    if (existedUser) {
        throw new ApiError(
            409,
            "User with email or username already exists"
        );
    }

    // Avatar
    const avatarLocalPath = req.files?.avatar?.[0]?.path;

    // Cover Image
    let coverImageLocalPath;

    if (
        req.files &&
        Array.isArray(req.files.coverImage) &&
        req.files.coverImage.length > 0
    ) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    // Upload Avatar
    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar) {
        throw new ApiError(400, "Avatar upload failed");
    }

    // Upload Cover Image
    let coverImage = "";

    if (coverImageLocalPath) {
        const uploadedCoverImage = await uploadOnCloudinary(
            coverImageLocalPath
        );

        coverImage = uploadedCoverImage?.url || "";
    }

    // Create User
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage,
        email,
        password,
        username: username.toLowerCase(),
    });

    // Remove password & refreshToken
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!createdUser) {
        throw new ApiError(
            500,
            "Something went wrong while registering the user"
        );
    }

    return res.status(201).json(
        new ApiResponse(
            201,
            createdUser,
            "User registered successfully"
        )
    );
});

// =============================================
// Login User
// =============================================
const loginUser = asyncHandler(async (req, res) => {
    const { email, username, password } = req.body;

    if (!username && !email) {
        throw new ApiError(400, "Username or Email is required");
    }

    const user = await User.findOne({
        $or: [{ username }, { email }],
    });

    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials");
    }

    const { accessToken, refreshToken } =
        await generateAccessAndRefereshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken,
                },
                "User logged in successfully"
            )
        );
});

// =============================================
// Logout User
// =============================================
const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1,
            },
        },
        {
            new: true,
        }
    );

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(
                200,
                {},
                "User logged out successfully"
            )
        );
});

const incommingRefreshToken= asyncHandler(async(req,res)=>{
    try {
        const incommingRefreshToken=  req.cookie.refreshAccessToken || req.body.refreshAccessToken
    
        if(!incommingRefreshToken){
            throw  new ApiError(401,"unauthorized request")
        }
    
         const decodedToken = jwt.verify(
            incommingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
       const user  =await User.findById(decodedToken?._id)
     if(!user){
            throw  new ApiError(401,"invaild refresh token")
        }
        if(incommingRefreshToken !== user?.refreshToken){
            throw new ApiError(401,"refresh token is exprired or used")
        }
    
        const options = {
            httpOnly:true ,
            secure:true
        }
        const{accessToken,newRefreshToken}=await generateAccessAndRefereshTokens(user._id)
    
       return res
       .status(200)
       .cookie("accessToken",accessToken,options)
       
       .cookie("refreshToken",newRefreshToken,options)
       .json(
        new ApiResponse(
            200,
               { accessToken,refreshToken: newRefreshToken},
                "Access token refreshed"
            
        )
       )
    } catch (error) {
       throw new ApiError(401,error?.massage ||
        "Invalid refresh token"
       ) 
    }
})
export {
    registerUser,
    loginUser,
    logoutUser,
    incommingRefreshToken
};