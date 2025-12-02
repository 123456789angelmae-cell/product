const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection
const DB_URL = 'mongodb+srv://Johnlee:12345@cluster0.aclepof.mongodb.net/';
const JWT_SECRET = '12345';

mongoose.connect(DB_URL)
    .then(() => console.log('Connected to Database'))
    .catch(err => console.log('Database Error:', err));

// Updated Product Schema with description and imageUrl
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    category: { type: String, default: 'Uncategorized' },
    quantity: { type: Number, required: true, default: 0 },
    unitPrice: { type: Number, required: true },
    imageUrl: { type: String, default: '' },
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(403).json({
            success: false,
            message: 'No token provided'
        });
    }
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }
        req.userId = decoded.id;
        req.userRole = decoded.role;
        next();
    });
};

// Middleware to verify admin role
const verifyAdmin = (req, res, next) => {
    if (req.userRole !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Admin only.'
        });
    }
    next();
};

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

// Get all products with pagination
app.get('/api/products', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 0;
        const skip = (page - 1) * limit;
        
        let query = Product.find({ active: true });
        
        if (limit > 0) {
            query = query.skip(skip).limit(limit);
        }
        
        const products = await query.sort({ createdAt: -1 });
        const total = await Product.countDocuments({ active: true });
        
        res.json({
            success: true,
            data: products,
            pagination: limit > 0 ? {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            } : null
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Search products
app.get('/api/products/search/:keyword', async (req, res) => {
    try {
        const keyword = req.params.keyword;
        
        const products = await Product.find({
            active: true,
            $or: [
                { name: { $regex: keyword, $options: 'i' } },
                { description: { $regex: keyword, $options: 'i' } },
                { category: { $regex: keyword, $options: 'i' } }
            ]
        });
        
        res.json({
            success: true,
            data: products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get products by category
app.get('/api/products/category/:category', async (req, res) => {
    try {
        const products = await Product.find({ 
            active: true,
            category: { $regex: req.params.category, $options: 'i' } 
        });
        
        res.json({
            success: true,
            data: products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get active products only
app.get('/api/products/filter/active', async (req, res) => {
    try {
        const products = await Product.find({ active: true });
        res.json({
            success: true,
            data: products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Low stock alert
app.get('/api/products/filter/lowstock/:threshold', async (req, res) => {
    try {
        const threshold = parseInt(req.params.threshold) || 10;
        const products = await Product.find({ 
            quantity: { $gt: 0, $lte: threshold } 
        });
        
        res.json({
            success: true,
            data: products,
            count: products.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Price range filter
app.get('/api/products/filter/price', async (req, res) => {
    try {
        const minPrice = parseFloat(req.query.min) || 0;
        const maxPrice = parseFloat(req.query.max) || Number.MAX_VALUE;
        
        const products = await Product.find({ 
            active: true,
            unitPrice: { $gte: minPrice, $lte: maxPrice } 
        });
        
        res.json({
            success: true,
            data: products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// In stock filter
app.get('/api/products/filter/instock', async (req, res) => {
    try {
        const products = await Product.find({ active: true, quantity: { $gt: 0 } });
        res.json({
            success: true,
            data: products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Out of stock filter
app.get('/api/products/filter/outofstock', async (req, res) => {
    try {
        const products = await Product.find({ active: true, quantity: 0 });
        res.json({
            success: true,
            data: products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Sort products
app.get('/api/products/sort/:field/:order', async (req, res) => {
    try {
        const { field, order } = req.params;
        const sortOrder = order === 'desc' ? -1 : 1;
        
        const validFields = ['name', 'unitPrice', 'quantity', 'category', 'createdAt'];
        const sortField = validFields.includes(field) ? field : 'name';
        
        const products = await Product.find({ active: true }).sort({ [sortField]: sortOrder });
        
        res.json({
            success: true,
            data: products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get all categories
app.get('/api/products/categories', async (req, res) => {
    try {
        const categories = await Product.distinct('category', { active: true });
        res.json({
            success: true,
            data: categories.filter(c => c)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get product by ID
app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }
        
        res.json({
            success: true,
            data: product
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================
// ADMIN ONLY ROUTES (Authentication required)
// ============================================

// Create product (ADMIN ONLY)
app.post('/api/products', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const newProduct = new Product({
            name: req.body.name,
            description: req.body.description || '',
            category: req.body.category || 'Uncategorized',
            quantity: req.body.quantity || 0,
            unitPrice: req.body.unitPrice,
            imageUrl: req.body.imageUrl || '',
            active: req.body.active !== undefined ? req.body.active : true
        });
        
        await newProduct.save();
        
        res.status(201).json({
            success: true,
            message: 'Product created!',
            data: newProduct
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Update product (ADMIN ONLY)
app.put('/api/products/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            {
                name: req.body.name,
                description: req.body.description,
                category: req.body.category,
                quantity: req.body.quantity,
                unitPrice: req.body.unitPrice,
                imageUrl: req.body.imageUrl,
                active: req.body.active,
                updatedAt: Date.now()
            },
            { new: true }
        );
        
        if (!updatedProduct) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Product updated!',
            data: updatedProduct
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Bulk update stock (ADMIN ONLY)
app.put('/api/products/bulk-update-stock', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const updates = req.body.updates;
        
        const results = await Promise.all(
            updates.map(async (update) => {
                return await Product.findByIdAndUpdate(
                    update.id,
                    { quantity: update.quantity, updatedAt: Date.now() },
                    { new: true }
                );
            })
        );
        
        res.json({
            success: true,
            message: 'Stock updated for multiple products',
            data: results
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Delete product (ADMIN ONLY)
app.delete('/api/products/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const deletedProduct = await Product.findByIdAndDelete(req.params.id);
        
        if (!deletedProduct) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Product deleted!',
            data: deletedProduct
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Server start
const PORT = 3000;
app.listen(PORT, () => {
    console.log('Server is running!');
    console.log('http://localhost:' + PORT);
});
