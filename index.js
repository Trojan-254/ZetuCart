require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");
const authRoutes = require("./routes/auth");
const sellerAuthRoutes = require("./routes/seller/auth");
const sellerRoutes = require("./routes/seller/seller");
const sellerDashboardRoutes = require("./routes/seller/dashboard");
const profileRoutes = require("./routes/profile");
const productRoutes = require("./routes/product");
const checkoutRoutes = require("./routes/checkout");
const cartRoutes = require("./routes/cart");
const orderRoutes = require("./routes/order");
const pathMiddleware = require("./middleware/pathMiddleware");
const sellerOrdersRoutes = require("./routes/seller/order");
const w = require("./routes/wishlist");
const mpesaRoutes = require('./routes/mpesa');
const errorHandler = require("./middleware/errorMiddleware");
const { auth } = require("./middleware/authMiddleware");
const app = express();
const cookieParser = require('cookie-parser');
const methodOverride = require('method-override');
const cors = require('cors');
const session = require('express-session');
const createFlashMiddleware = require('./middleware/flashMiddleware');


// App middlewares
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "views")));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));
app.use(pathMiddleware);
app.use(cors());

// Error handling middleware
app.use(errorHandler);

// Flash messages
app.use(createFlashMiddleware());

// EJS Template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(methodOverride('_method'));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));


// Mongodb connection
mongoose.connect(process.env.MONGO_URL)
.then(() => {
    console.log("Connection to database has been established...");
}).catch(err => {
    console.log(err);
});

// Routes
app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);
app.use("/products", productRoutes);
app.use("/cart", cartRoutes);
app.use('/api', mpesaRoutes);
app.use("/checkout", checkoutRoutes);
app.use("/orders", orderRoutes);
app.use("/wishlist", w);
app.use("/email-verification/:token", authRoutes);
app.use("/seller/auth", sellerAuthRoutes);
app.use("/api/seller", sellerRoutes);
app.use('/order/seller', sellerOrdersRoutes);
app.use("/seller/dashboard", sellerDashboardRoutes);

app.get('/', (req, res) => {
    res.render('landing', { isAuthenticated: req.isAuthenticated });
});

app.get("/signup", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "signup.html"));
});

app.get("/seller/register", (req, res) => {
    res.render('seller/register');
});

app.get('/seller/login', (req, res) => {
    res.render('seller/login');
});

app.get("/confirmation", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "confirmation.html"));
});

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.get("/dashboard", auth, (req, res) => {
    try {
        console.log('User object', req.user);
        res.render('dashboard', { firstname: req.user.firstName });
    } catch (error) {
        console.error('Error rendering dashboard:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.clear();
    console.log(`
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                           ┃
    ┃                                                           ┃
    ┃               🚀🚀  Zetu Cart Server is Live!   🚀🚀      ┃
    ┃                                                           ┃
    ┃                                                           ┃
    ┃ --------------------------------------------------------- ┃
    ┃ 🌐        Listening on: http://localhost:${PORT}             ┃
    ┃             📡 Connecting to database... 📡               ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    `);
});
