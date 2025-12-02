const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

//mongodb
const DB_URL = 'mongodb+srv://raven:12345@test.q3j1urd.mongodb.net/Products';
const JWT_SECRET = '12345';

mongoose.connect(DB_URL)
    .then(() => console.log('✓ Connected to Database'))
    .catch(err => console.log('✗ Database Error:', err));

//schema/model
const productSchema = new mongoose.Schema({
    sku: String,
    name: String,
    category: String,
    quantity: Number,
    unitPrice: Number,
    expiry: Date,
    active: Boolean
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

//get all products with pagination
app.get('/api/products', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 0; // 0 means no limit
        const skip = (page - 1) * limit;
        
        let query = Product.find();
        
        if (limit > 0) {
            query = query.skip(skip).limit(limit);
        }
        
        const products = await query;
        const total = await Product.countDocuments();
        
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

//search products (MOVED BEFORE :id route)
app.get('/api/products/search/:keyword', async (req, res) => {
    try {
        const keyword = req.params.keyword;
        
        const products = await Product.find({
            $or: [
                { sku: { $regex: keyword, $options: 'i' } },
                { name: { $regex: keyword, $options: 'i' } },
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

//get products by category
app.get('/api/products/category/:category', async (req, res) => {
    try {
        const products = await Product.find({ 
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

//get active products only
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

//low stock alert
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

//expired products
app.get('/api/products/filter/expired', async (req, res) => {
    try {
        const products = await Product.find({ 
            expiry: { $lt: new Date() } 
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

//price range filter
app.get('/api/products/filter/price', async (req, res) => {
    try {
        const minPrice = parseFloat(req.query.min) || 0;
        const maxPrice = parseFloat(req.query.max) || Number.MAX_VALUE;
        
        const products = await Product.find({ 
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

//in stock filter
app.get('/api/products/filter/instock', async (req, res) => {
    try {
        const products = await Product.find({ quantity: { $gt: 0 } });
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

//out of stock filter
app.get('/api/products/filter/outofstock', async (req, res) => {
    try {
        const products = await Product.find({ quantity: 0 });
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

//sort products
app.get('/api/products/sort/:field/:order', async (req, res) => {
    try {
        const { field, order } = req.params;
        const sortOrder = order === 'desc' ? -1 : 1;
        
        const validFields = ['name', 'unitPrice', 'quantity', 'category'];
        const sortField = validFields.includes(field) ? field : 'name';
        
        const products = await Product.find().sort({ [sortField]: sortOrder });
        
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

//product by id
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

//create product (ADMIN ONLY)
app.post('/api/products', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const newProduct = new Product({
            sku: req.body.sku,
            name: req.body.name,
            category: req.body.category,
            quantity: req.body.quantity,
            unitPrice: req.body.unitPrice,
            expiry: req.body.expiry,
            active: req.body.active
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

//update product (ADMIN ONLY)
app.put('/api/products/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            {
                sku: req.body.sku,
                name: req.body.name,
                category: req.body.category,
                quantity: req.body.quantity,
                unitPrice: req.body.unitPrice,
                expiry: req.body.expiry,
                active: req.body.active
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

//bulk update stock (ADMIN ONLY)
app.put('/api/products/bulk-update-stock', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const updates = req.body.updates; // [{id, quantity}, ...]
        
        const results = await Promise.all(
            updates.map(async (update) => {
                return await Product.findByIdAndUpdate(
                    update.id,
                    { quantity: update.quantity },
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

//delete product (ADMIN ONLY)
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

//server start
const PORT = 3000;
app.listen(PORT, () => {
    console.log('✓ Server is running!');
    console.log('✓ http://localhost:' + PORT);
});
