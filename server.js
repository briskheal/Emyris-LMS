const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

// --- CLOUD CONFIG ---
cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'emyris_lms',
        resource_type: 'auto'
    }
});
const upload = multer({ storage: storage });

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
    active: { type: Boolean, default: true },
    lastLogin: Date
});

const CompanySchema = new mongoose.Schema({
    logo: String,
    address: String,
    phone: String,
    website: String,
    tollFree: String,
    updatedAt: { type: Date, default: Date.now }
});

const CategorySchema = new mongoose.Schema({
    name: { type: String, unique: true },
    active: { type: Boolean, default: true }
});

const Product = mongoose.model('Product', ProductSchema);
const Employee = mongoose.model('Employee', EmployeeSchema);
const Company = mongoose.model('Company', CompanySchema);
const Category = mongoose.model('Category', CategorySchema);

// --- API ENDPOINTS ---

// Auth
app.post('/api/auth/login', async (req, res) => {
    let { empCode, password, isAdmin } = req.body;
    if (empCode) empCode = empCode.trim();
    if (password) password = password.trim();

    console.log(`[AUTH] Login Attempt - Code: "${empCode}", Admin: ${isAdmin}`);

    if (isAdmin) {
        if (empCode === 'EMYRISLMS' && password === 'EMYRIS_LMS') {
            return res.json({ success: true, role: 'admin' });
        }
    } else {
        const emp = await Employee.findOne({ empCode, password });
        if (emp) {
            console.log(`[AUTH] Success: Found user ${emp.name}`);
            if (!emp.active) return res.status(403).json({ success: false, message: 'Account Deactivated' });
            emp.lastLogin = new Date();
            await emp.save();
            return res.json({ success: true, role: 'employee', name: emp.name });
        } else {
            console.log(`[AUTH] Failed: No match found for Code: "${empCode}" and Password: "${password}"`);
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

app.patch('/api/products/:id', async (req, res) => {
    try {
        await Product.findByIdAndUpdate(req.params.id, req.body);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
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
        let { name, empCode, password } = req.body;
        const emp = new Employee({ 
            name, 
            empCode: empCode ? empCode.trim() : '', 
            password: password ? password.trim() : '' 
        });
        await emp.save();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Data Sanitizer (Runs once on startup)
const sanitizeData = async () => {
    const emps = await Employee.find();
    for (let e of emps) {
        let changed = false;
        if (e.empCode && e.empCode !== e.empCode.trim()) { e.empCode = e.empCode.trim(); changed = true; }
        if (e.password && e.password !== e.password.trim()) { e.password = e.password.trim(); changed = true; }
        if (changed) await e.save();
    }
    console.log('✨ Database Sanitized: All whitespace removed from credentials.');
};
sanitizeData();

app.get('/api/employees', async (req, res) => {
    try {
        const employees = await Employee.find().sort({ empCode: 1 });
        res.json({ success: true, employees });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.patch('/api/employees/:id', async (req, res) => {
    try {
        await Employee.findByIdAndUpdate(req.params.id, req.body);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.patch('/api/employees/:id/status', async (req, res) => {
    try {
        const { active } = req.body;
        await Employee.findByIdAndUpdate(req.params.id, { active });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

// Company Settings
app.get('/api/company', async (req, res) => {
    let company = await Company.findOne();
    if (!company) company = await Company.create({ address: '' });
    res.json(company);
});

app.post('/api/company', async (req, res) => {
    await Company.findOneAndUpdate({}, req.body, { upsert: true });
    res.json({ success: true });
});

// Category Management
app.get('/api/categories', async (req, res) => {
    const defaultCats = ['Injectables', 'Enteral Nutrition', 'Nutraceuticals', 'Pharmaceuticals'];
    let cats = await Category.find();
    if (cats.length === 0) {
        for (let name of defaultCats) await Category.create({ name });
        cats = await Category.find();
    }
    res.json(cats);
});

// Cloud Upload Endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
    try {
        res.json({ success: true, url: req.file.path });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/categories', async (req, res) => {
    try {
        const { name } = req.body;
        await Category.create({ name, active: true });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.patch('/api/categories/:id', async (req, res) => {
    await Category.findByIdAndUpdate(req.params.id, req.body);
    res.json({ success: true });
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
