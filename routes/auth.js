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
   const { firstName, lastName, email, password1, password2 } = req.body;
   if (!firstName || !lastName || !email || !password1 || !password2) {
        return res.status(400).json({ message: "All fields are required." });
    }

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

      // Check if password1 resembles password2
      if (password1 !== password2) {
          return res.status(400).json({ msg: "The first password is not same as the second password" });
      }
      // Hash the user password
       const hashedPassword = await bcrypt.hash(password1, 10);
        
      // Create and save new User
       const newUser = new User({
           firstName,
           lastName,
           email,
           password: hashedPassword
       });

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
      res.render("confirmation", { email });
         } catch (err) {
     console.error('Failed to register user: ', err);
     res.status(500).json({error: err.message });
   }
});

// Login route
// Login route
router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: "User not found!" });

        // Check if user's email is verified
        if (!user.emailVerified) {
           return res.status(400).json({ msg: "Please verify your email before you log in." });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

        const payload = {
            user: {
              id: user._id,
              firstName: user.firstName,
            },
        };

        // Generate JWT
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });

        // Send token in an HTTP-only cookie
        res.cookie('authToken', token, {
           httpOnly: true,
           secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
           sameSite: 'Strict',
           maxAge: 3600000, // Match JWT expiry time (1 hour)
        });
        res.status(200).json({ msg: 'Login successfull', redirectUrl: '/dashboard' }); // Optionally, you can just send success message
    } catch (err) {
        console.error('Failed to login user', err);
        res.status(500).json({ error: err.message });
    }
});


// Logout
router.post('/logout', (req, res) => {
   try {
      res.clearCookie('authToken');
      res.redirect('/login');
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

// Verify email
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
        user.emailVerified = true;
        user.verificationToken = null;
        await user.save();


        // Redirect to the login page
        return res.render("confirm", { username: user.username });
        // Redirect to the success confirmation page
        return res.render("confirm", { username: user.username});
    } catch (err) {
        if (err.name === 'JsonWebTokenError') {
           return res.status(400).send("Invalid token format");
        }
        if (err.name === 'TokenExpiredError') {
           return res.status(400).send("Token has expired");
        }
        console.error(err);
        return res.status(500).send("<h1>Server error</h1>");
    }
});



// verify email
router.get("/updated-email-verification/:token", async (req, res) => {
    const { token } = req.params;

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;
        const newEmail = decoded.newEmail;

        // Find the user by ID
        const user = await User.findById(userId);
        if (!user || user.verificationToken !== token) {
            return res.status(400).send("<h1>Invalid or expired token</h1>");
        }


        // Update user email to new email
        user.email = newEmail;
        user.verified = true;
        user.newEmail = null;
        user.verificationToken = null;
        await user.save();

        // Redirect to the success confirmation page
        return res.render("confirm", { username: user.username});
    } catch (err) {
        console.error(err);
        return res.status(500).send("<h1>Server error</h1>");
    }
});

// Final password update
router.post('/new-password/:token', async (req, res) => {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (password !== confirmPassword)
       return res.status(400).json({ message: 'Passwords do not match '});

    try {
       const user = await User.findOne({
          resetToken: token,
          resetTokenExpiry: { $gt: Date.now() }
       });

    if (!user) return res.status(400).json({ message: 'Invalid or expired token'});

   // Update password
   user.password = password;
   user.resetToken = undefined;
   user.resetToken = undefined;
   await user.save();

   res.json({ message: 'Password updated. Please log in. '});
    } catch(err) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Reset password route
router.get('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    try {
      const user = await User.findOne({
         resetToken: token,
         resetTokenExpiry: { $gt: Date.now() }
      });

      if (!user) return res.status(400).json({ message: 'Invalid or expired token'});

      // Clear the password and token for security
      user.password = null;
      user.resetToken = undefined;
      user.resetTokenExpiry = undefined;
      await user.save();

      res.redirect(`/new-password/${token}`);
    } catch (err) {
      res.status(500).
    }
});

// Forgot password route
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'User not found' });

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetToken = resetToken;
        user.resetTokenExpiry = Date.now() + 3600000;
        await user.save();

       // Send reset email
       const resetLink = `http://localhost:5000/reset-password/${resetToken}`;
       await transporter.sendMail ({
           to: user.email,
           subject: 'Password Reset Request',
           html: `<p>Click <a href="${resetLink}">here</a> to reset your password.</p>`
       });

       res.json({ message: 'Password reset link has been sent to your email.'});
    } catch (err) {
       res.status(500).json({ message: 'Internal Server Error' });
    }
});

module.exports = router;
