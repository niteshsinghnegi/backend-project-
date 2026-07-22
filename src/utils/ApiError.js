// Custom Error Class
// Is class ka use API errors ko standard format me return karne ke liye hota hai.

class ApiError extends Error {
    constructor(
        statusCode,
        message = "Something went wrong",
        errors = [],
        stack = ""
    ) {
        // Parent Error class ko message bhejte hain
        super(message);

        // Custom Properties
        this.statusCode = statusCode;
        this.data = null;
        this.message = message;
        this.success = false;
        this.errors = errors;

        // Agar custom stack diya gaya hai to use use karo
        if (stack) {
            this.stack = stack;
        } else {
            // Warna current error ka stack trace generate karo
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

// Export the class
export { ApiError };