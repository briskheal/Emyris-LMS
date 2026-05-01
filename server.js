const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001; 

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static('.'));

// MongoDB Connection
const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/emyris_lms';

mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    const isAtlas = mongoURI.includes('mongodb.net') || mongoURI.startsWith('mongodb+srv');
    console.log(`✅ Connected to Database: ${isAtlas ? 'Atlas (emyris_lms)' : 'Local'}`);
})
  .catch(err => console.error('❌ DB Connection Error:', err));

// --- SCHEMAS ---

const ProductSchema = new mongoose.Schema({
    title: { type: String, required: true },
    category: { 
        type: String, 
        enum: ['Injectables', 'Enteral Nutrition', 'Nutraceuticals', 'Pharmaceuticals'],
        required: true 
    },
    scientificInfo: String,
    dosageInfo: String,
    indications: String,
    image: String, // Packing/Product Photo
    videoUrl: String, // YouTube or Direct Link
    documents: [{ 
        name: String, 
        data: String // Base64 PDF/Doc
    }],
    createdAt: { type: Date, default: Date.now }
});

const EmployeeSchema = new mongoose.Schema({
    empCode: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    name: String,
    lastLogin: Date
});

const Product = mongoose.model('Product', ProductSchema);
const Employee = mongoose.model('Employee', EmployeeSchema);

// --- API ENDPOINTS ---

// Auth
app.post('/api/auth/login', async (req, res) => {
    const { empCode, password, isAdmin } = req.body;
    
    if (isAdmin) {
        if (empCode === 'EMYRISLMS' && password === 'EMYRIS_LMS') {
            return res.json({ success: true, role: 'admin' });
        }
    } else {
        // Hardcoded Employee Bypass
        if (empCode === 'user' && password === 'EMYRISLMS') {
            return res.json({ success: true, role: 'employee', name: 'Emyris Staff' });
        }

        const emp = await Employee.findOne({ empCode, password });
        if (emp) {
            emp.lastLogin = new Date();
            await emp.save();
            return res.json({ success: true, role: 'employee', name: emp.name });
        }
    }
    res.status(401).json({ success: false, message: 'Invalid Credentials' });
});

// Products
app.get('/api/products', async (req, res) => {
    try {
        const { category } = req.query;
        const query = category ? { category } : {};
        const products = await Product.find(query).sort({ createdAt: -1 });
        res.json({ success: true, products });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/products', async (req, res) => {
    try {
        const product = new Product(req.body);
        await product.save();
        res.json({ success: true, product });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

// Admin: Add Employee
app.post('/api/employees', async (req, res) => {
    try {
        const emp = new Employee(req.body);
        await emp.save();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/employees', async (req, res) => {
    try {
        const employees = await Employee.find().sort({ empCode: 1 });
        res.json({ success: true, employees });
    } catch (e) { res.status(500).json({ success: false }); }
});

// Serve Frontend
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/employee', (req, res) => {
    res.sendFile(path.join(__dirname, 'employee.html'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Emyris LMS Server running on http://localhost:${PORT}`);
});
