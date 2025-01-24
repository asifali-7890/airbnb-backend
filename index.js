const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const User = require('./models/User'); // No need for .js extension
const jwt = require('jsonwebtoken');
const imageDownloader = require('image-downloader');
const path = require('path');
const multer = require('multer');
const PlaceModel = require('./models/Place');
const BookingModel = require('./models/Booking');

// Load environment variables from .env file
dotenv.config();

const app = express();
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(__dirname + '/uploads'));


// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL)
    .then(() => {
        console.log('MongoDB Connection Established');
    })
    .catch((error) => {
        console.log('MongoDB Connection Error: ' + error);
    });

const PORT = process.env.PORT || 4000;

// https://airbnb-client-w23q.vercel.app
// Middleware


app.use(cors({
    origin: [
        'https://airbnb-client-ntyq.vercel.app/',
        'https://airbnb-client-w23q.vercel.app',  // Deployed frontend
        'http://127.0.0.1:5173',  // Local environment
    ],
    credentials: true,  // Enable sending credentials (cookies, etc.)
}));
app.use(express.json());
;
// c532152ad6f330270b632b3a5448663b
// Middleware and routes can be defined here

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

app.get('/test', (req, res) => {
    return res.json({ name: 'ASIF IS GREAT...' });
});

// Authentication middleware
const authenticateUser = (req, res, next) => {
    const { authToken } = req.cookies; // Get authToken from cookies

    if (!authToken) {
        return res.status(401).json({ message: 'Unauthorized: Please log in' });
    }

    try {
        // Verify the token
        const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
        req.user = decoded; // Attach user data to the request
        next(); // Proceed to the next middleware or route handler
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};


// Register route
app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        // Check if the user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already in use' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10); // 10 is the salt rounds

        // Create a new user
        const newUser = new User({
            name,
            email,
            password: hashedPassword, // Store the hashed password
        });

        // Save the user to the database
        await newUser.save();
        // console.log('newUser', newUser);

        // Respond with the user data (excluding the password)
        return res.json({
            name: newUser.name,
            email: newUser.email,
            password: newUser.password
        });
    } catch (error) {
        console.error('Error creating user:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

// User login route
app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const token = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.cookie("authToken", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 3600000,
            sameSite: 'None' // Allow cross-origin requests
        });

        res.status(200).json(user);
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get('/profile', async (req, res) => {
    const { authToken } = req.cookies; // Get the authToken from cookies

    if (authToken) {
        try {
            // Verify the token
            const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
            const userId = decoded.id; // Extract userId from the token

            // Fetch user data from the database
            const { name, email, password } = await User.findById(userId); // Exclude password from the response
            if (email) {
                // If user is found, send user data
                return res.json({ name, email, password });
            } else {
                return res.status(404).json({ message: 'User  not found' });
            }
        } catch (error) {
            console.error('Error verifying token:', error);
            return res.status(401).json({ message: 'Invalid token' });
        }
    } else {
        return res.status(401).json({ message: 'No token provided' });
    }
});

// app.post('/logout', function (req, res) {
//     res.cookie('authToken', '').json(true);
// })

app.post('/logout', (req, res) => {
    res.clearCookie('authToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'None',
    });
    res.json({ message: 'Logged out successfully' });
});

// POST route to upload by link
app.post('/upload-by-link', async (req, res) => {
    const { link } = req.body;

    // Validate the link
    if (!link) {
        return res.status(400).send('Link is required');
    }

    // Set the destination path
    const newName = Date.now() + '.jpg';
    const options = {
        url: link,
        dest: path.join(__dirname, 'uploads', newName) // Correct concatenation with path.join
    };


    try {
        // Download the image
        const { filename } = await imageDownloader.image(options);
        res.status(200).send(newName);
    } catch (error) {
        console.error(error);
        res.status(500).send('Failed to download image');
    }
});


// Set storage engine
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'uploads')); // Directory where files will be saved
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Generating a unique file name
    },
});

// Initialize multer with the storage configuration
const upload = multer({ storage });

// POST route to handle file upload
app.post('/upload-photos', upload.array('photos', 10), (req, res) => {
    if (!req.files) {
        return res.status(400).send('No files uploaded');
    }

    // Map through the uploaded files and return their names
    const uploadedPhotos = req.files.map(file => file.filename);

    // Send the list of uploaded files as the response
    res.status(200).send({ uploadedPhotos });
});





// Route to save a new place
app.post('/places', async (req, res) => {
    const { title, address, photos, description, perks, extraInfo, checkIn, checkOut, maxGuests, price } = req.body;

    try {
        // Extract authToken from cookies
        const { authToken } = req.cookies;

        if (!authToken) {
            return res.status(401).json({ error: 'Unauthorized: No token provided' });
        }

        // Verify and decode the token
        const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
        const userId = decoded.id; // Extract `userId` from the token payload

        // Create a new place document
        const place = new PlaceModel({
            title,
            address,
            photos,
            description,
            perks,
            extraInfo,
            checkIn,
            checkOut,
            maxGuests,
            price,
            owner: userId, // Set the owner as the decoded `userId`
        });

        // Save the place to the database
        await place.save();
        res.status(201).json({ message: 'Place saved successfully!', place });
    } catch (error) {
        console.error('Error saving place:', error);
        res.status(500).json({ error: 'Failed to save the place' });
    }
});


// Your route for /places
app.get('/user-places', async (req, res) => {
    try {
        // Extract authToken from cookies
        const { authToken } = req.cookies;

        if (!authToken) {
            // console.log('No auth token', authToken);
            return res.status(401).json({ error: 'Unauthorized: No token provided' });
        }

        // Verify and decode the token
        const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
        const userId = decoded.id;

        // Fetch places associated with the user
        const places = await PlaceModel.find({ owner: userId });
        // console.log('userId', userId)
        // console.log('Found places associated with', places)
        // Send the places as a JSON response
        res.json(places);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch places' });
    }
});

// Route to fetch a single place by its ID
app.get('/places/:id', async (req, res) => {
    try {
        const placeId = req.params.id;  // Get the place ID from the URL parameter
        const place = await PlaceModel.findById(placeId);  // Fetch the place from the database using the ID

        if (!place) {
            return res.status(404).json({ message: 'Place not found' });  // If place not found
        }

        res.status(200).json(place);  // Return the place data
    } catch (error) {
        console.error('Error fetching place:', error);
        res.status(500).json({ message: 'Server error' });  // Handle server errors
    }
});

// Update a place by ID
app.put('/places/:id', async (req, res) => {
    try {
        const { authToken } = req.cookies;
        if (!authToken) return res.status(401).json({ error: 'Unauthorized' });

        const { id: userId } = jwt.verify(authToken, process.env.JWT_SECRET);
        const place = await PlaceModel.findById(req.params.id);
        if (!place || place.owner.toString() !== userId) return res.status(403).json({ error: 'Forbidden' });

        const updatedPlace = await PlaceModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json(updatedPlace);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});



// Get all places
app.get('/places', async (req, res) => {
    try {
        const { authToken } = req.cookies;

        // Check if the token exists
        if (!authToken) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify the token and extract user information
        const { id: userId } = jwt.verify(authToken, process.env.JWT_SECRET);


        // Fetch places if the token is valid
        const places = await PlaceModel.find({});
        res.json(places);
    } catch (err) {
        console.error('Error verifying authToken:', err.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


app.get('/bookings', async (req, res) => {
    try {
        // Extract and verify user data from the request
        const userData = await getUserDataFromReq(req);

        // Fetch bookings for the specific user
        const bookings = await BookingModel.find({ user: userData.id }).populate('place')

        // Respond with bookings data
        res.json(bookings);
    } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Helper function to extract user data from the request
async function getUserDataFromReq(req) {
    const { authToken } = req.cookies; // Extract the token from cookies
    if (!authToken) throw new Error("Unauthorized");

    // Verify token and extract user ID
    const userData = jwt.verify(authToken, process.env.JWT_SECRET);
    return userData; // Assuming the token contains { id: userId }
}


app.post('/bookings', async (req, res) => {
    const userData = await getUserDataFromReq(req);
    const {
        place, checkIn, checkOut, numberOfGuests, name, phone, price,
    } = req.body;
    BookingModel.create({
        place, checkIn, checkOut, numberOfGuests, name, phone, price,
        user: userData.id,
    }).then((doc) => {
        res.json(doc);
    }).catch((err) => {
        throw err;
    });
});