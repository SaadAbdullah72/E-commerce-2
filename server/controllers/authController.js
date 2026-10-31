const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { JWT_SECRET } = require('../middleware/auth');

// POST /api/auth/signup (or /api/auth/register)
async function signup(req, res) {
  try {
    const { name, email, password, phone, address, city, zipCode, country } = req.body;

    // Validate inputs
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.',
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [trimmedEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists. Please sign in.',
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert user into PostgreSQL
    const insertQuery = `
      INSERT INTO users (name, email, password, role, phone, address, city, zip_code, country)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, name, email, role, phone, address, city, zip_code, country, created_at
    `;

    const values = [
      name.trim(),
      trimmedEmail,
      hashedPassword,
      'customer',
      phone || null,
      address || null,
      city || null,
      zipCode || null,
      country || null,
    ];

    const result = await db.query(insertQuery, values);
    const newUser = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: newUser,
    });
  } catch (error) {
    console.error('Error during signup:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating account. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Query user by email
    const query = `
      SELECT id, name, email, password, role, phone, address, city, zip_code, country, created_at
      FROM users
      WHERE LOWER(email) = LOWER($1)
    `;
    const result = await db.query(query, [trimmedEmail]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const user = result.rows[0];

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Omit password hash in response
    const { password: _, ...userWithoutPassword } = user;

    return res.status(200).json({
      success: true,
      message: 'Login successful!',
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

// GET /api/auth/me (Protected)
async function getMe(req, res) {
  return res.status(200).json({
    success: true,
    user: req.user,
  });
}

// PUT /api/auth/profile (Protected)
async function updateProfile(req, res) {
  try {
    const { name, phone, address, city, zipCode, country } = req.body;
    const userId = req.user.id;

    const updateQuery = `
      UPDATE users
      SET 
        name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        address = COALESCE($3, address),
        city = COALESCE($4, city),
        zip_code = COALESCE($5, zip_code),
        country = COALESCE($6, country),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING id, name, email, role, phone, address, city, zip_code, country, updated_at
    `;

    const result = await db.query(updateQuery, [
      name ? name.trim() : null,
      phone !== undefined ? phone : null,
      address !== undefined ? address : null,
      city !== undefined ? city : null,
      zipCode !== undefined ? zipCode : null,
      country !== undefined ? country : null,
      userId,
    ]);

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully!',
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating profile.',
    });
  }
}

module.exports = {
  signup,
  login,
  getMe,
  updateProfile,
};
