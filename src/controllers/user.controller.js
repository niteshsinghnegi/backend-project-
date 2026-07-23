import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";


const generateAccessAndRefereshTokens = async (userId) => {
    try {
        const user = await User.findById(userId)

        const accessToken = user.generateAccessToken()

        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }


    } catch (error) {
        throw new ApiError(500, "something went wrong while generating refersh or access token")

    }
}

const registerUser = asyncHandler(async (req, res) => {

    // ==============================
    // Get user data from frontend
    // ==============================
    const { fullName, email, username, password } = req.body;

    // ==============================
    // Validation - Check empty fields
    // ==============================
    if (
        [fullName, email, username, password].some(
            (field) => field?.trim() === ""
        )
    ) {
        throw new ApiError(400, "All fields are required");
    }

    // ==============================
    // Check if user already exists
    // ==============================
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    });

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists");
    }

    // ==============================
    // Get uploaded file paths
    // ==============================

    // Avatar file (Required)
    const avatarLocalPath = req.files?.avatar?.[0]?.path;

    // Cover Image (Optional)
    let coverImageLocalPath;

    if (
        req.files &&
        Array.isArray(req.files.coverImage) &&
        req.files.coverImage.length > 0
    ) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    // ==============================
    // Avatar validation
    // ==============================
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    // ==============================
    // Upload Avatar to Cloudinary
    // ==============================
    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar) {
        throw new ApiError(400, "Avatar upload failed");
    }

    // ==============================
    // Upload Cover Image (Optional)
    // ==============================
    let coverImage = "";

    if (coverImageLocalPath) {
        const uploadedCoverImage = await uploadOnCloudinary(coverImageLocalPath);
        coverImage = uploadedCoverImage?.url || "";
    }

    // ==============================
    // Create User
    // ==============================
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage,
        email,
        password,
        username: username.toLowerCase()
    });

    // ==============================
    // Remove password & refreshToken
    // ==============================
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!createdUser) {
        throw new ApiError(
            500,
            "Something went wrong while registering the user"
        );
    }

    // ==============================
    // Send Response
    // ==============================
    return res.status(201).json(
        new ApiResponse(
            201,
            createdUser,
            "User registered successfully"
        )
    );
});

// loginuser

const loginUser = asyncHandler(async (req, res) => {
    // req body -> data 
    //  verify user with username or email
    // find the user 
    // paswword chech 
    // send cookie

    const { email, username, password } = req.body
    if (!username || !email) {
        throw new ApiError(400, "username or password is required")
    }

    const user = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (!user) {
        throw new ApiError(404, "user does exist")
    }

    const isPasswordVaild = await user.isPasswordCorrect(password)
    if (!isPasswordVaild) {
        throw new ApiError(401, "Invaild User credentials")
    }

    const { accessToken, refreshToken } = await
        generateAccessAndRefereshTokens(user._id)

    const loggedInUser = await User.findById(user._id)
    select("-password -refreshToken")


    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken,
                    refreshToken
                },
                "user logged in successfully"
            )
        )
})

const logoutUser = asyncHandler (async(req,res)=>{
    await User.findByIdAndUpdate(
    req.user._id,{
        $set:{
            refreshToken : undefined
        }
    },
    {
        new: true
    }
   )

       const options = {
        httpOnly: true,
        secure: true
    }
    return  res 
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse)(200,{},"User logged out ")
})

export {
    registerUser,
    loginUser,
    logoutUser
};