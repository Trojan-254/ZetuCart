const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
    const token = req.cookies.authToken;
    console.log(req.header)

    if (!token) {
        req.isAuthenticated = false;
        return res.status(401).json({ error: 'No token, authorization denied', message: 'Please login to access this route' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Decoded token:', decoded);
        req.user = decoded.user;  // Attach the decoded user data to req.user
        req.isAuthenticated = true;
        next();
    } catch (err) {
        console.error('Token verification failed:', err);
        req.isAuthenticated = false;
        res.status(401).json({ error: 'Token is not valid' });
    }
};

module.exports = auth;
