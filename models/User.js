const mongoose = require('mongoose');

// Define the User schema
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true, // Name is required
    },
    email: {
        type: String,
        required: true, // Email is required
        unique: true
    },
    password: {
        type: String,
        required: true, // Password is required
    }
});

// Create the User model
const User = mongoose.model('Users', userSchema);

module.exports = User;