const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const router = express.Router();

dotenv.config();



// sign up route
router.post("/signup", async(req, res) => {
   const { username, email, password } = req.body;

   try {
      // Check is user exists
      let user = await User.findOne({ email });
      if (user) {
         if (req.headers["content-type"] === "application/json") {
            return res.status(400).json({ msg: "User already exists"});
         } else {
           return res.status(400).send("User already exists. Try logging in!");
         }
      }
      

      // Hash the user password
       const hashedPassword = await bcrypt.hash(password, 10);
        
      // Create and save new User
       const newUser = new User({ username, email, password: hashedPassword });
      //  await user.save();
       //console.log("A new user has been succesfully registered...");

      // Redirect user to login
      // if (req.headers["content-type"] !== "application/json") {
      //     // Send the verification email
      //     sendVerificationEmail(email, token);
      //     return res.status(201).send("Registration succesfull. Please check your email to verify your account.");
      // }

      const userId = newUser._id;
      // Generate JWT
      const token = jwt.sign(
         { id: userId },
         process.env.JWT_SECRET,
         { expiresIn: "1h" }
      );

      // Save token to user model
      newUser.verificationToken = token;
      await newUser.save();

      // Send verification email
      sendVerificationEmail(email, token);
      
      console.log("A new user has been registered succesfully...");
      // res.status(201).json({ msg: "Registration succesfull. Please check you email for verification.!" });
      res.redirect("/confirmation");
         } catch (err) {
     console.error('Failed to register user: ', err);
     res.status(500).json({error: err.message });
   }
});

// Login route
router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: "User not found!" });
        // Check id user's email is verified
        if (!user.verified) {
           return res.status(400).json({ msg: "Please verify your email before you log in."})
        }
        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

        const payload = {
            user: {
              id: user._id,
            },
        };
        // Generate JWT
        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        // Send token in an HTTP-only cookie
        res.cookie('authToken', token, {
           httpOnly: true,
           secure: process.env.NODE_ENV === 'production',
           sameSite: 'Strict',
           maxAge: 36000000,
        });
        res.status(200).json({ token });
    } catch (err) {
        console.error('failed to login user', err);
        res.status(500).json({ error: err.message });
    }
});

// Logout
router.post('/logout', (req, res) => {
   try {
   res.clearCookie('authToken');
   res.json({ success: true, message: 'Logged out successfully' });
   } catch (err) {
     console.error('Failed to logout user', err);
   }
});

const transporter = nodemailer.createTransport({
   service: 'gmail',
   auth: { 
      user: process.env.EMAIL,
      pass: process.env.PASSWORD,
   },
});

const sendVerificationEmail = (email, token) => {
     const verificationUrl = `http://localhost:5000/auth/email-verification/${token}`;

     const mailOptions = {
          from: process.env.EMAIL,
          to: email,
          subject: "Please verify your email address",
          html: `<p>Click <a href="${verificationUrl}">here</a> to verify your email address.</p>`,
     };

     transporter.sendMail(mailOptions, (error, info) => {
         if (error) {
                console.log("Error sending email:", error);
             } else {
                console.log("Email sent:", info.response);
             }
         });
      };


// verify email
router.get("/email-verification/:token", async (req, res) => {
    const { token } = req.params;

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        // Find the user by ID
        const user = await User.findById(userId);
        if (!user) {
            return res.status(400).send("<h1>Invalid or expired token</h1>");
        }

        // Check if the token matches
        if (user.verificationToken !== token) {
            return res.status(400).send("<h1>Invalid or expired token</h1>");
        }

        // Mark the user as verified
        user.verified = true;
        user.verificationToken = null;
        await user.save();

        // Redirect to the login page
        return res.redirect("/login");
    } catch (err) {
        console.error(err);
        return res.status(500).send("<h1>Server error</h1>");
    }
});


module.exports = router;
