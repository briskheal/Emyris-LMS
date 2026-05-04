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

// Request Logger for Render Logs
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Health Check for Render
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// MongoDB Connection
const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/emyris_lms';

mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
}).then(() => {
    const isAtlas = mongoURI.includes('mongodb.net') || mongoURI.startsWith('mongodb+srv');
    console.log(`✅ Connected to Database: ${isAtlas ? 'Atlas (emyris_lms)' : 'Local'}`);
    
    // Run sanitization ONLY after connection is successful to prevent buffering timeouts
    sanitizeData().catch(err => console.error('❌ Sanitization Error:', err));
})
.catch(err => {
    console.error('❌ DB Connection Error:', err);
    console.log('💡 TIP: Check if your IP is whitelisted in MongoDB Atlas or if the URI is correct.');
});

// Better Connection Monitoring
mongoose.connection.on('error', err => {
    console.error('🔴 Mongoose Connection Error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.warn('🟡 Mongoose Disconnected. Attempting to reconnect...');
});

// --- SCHEMAS ---

const ProductSchema = new mongoose.Schema({
    title: { type: String, required: true },
    category: { 
        type: String, 
        required: true 
    },
    scientificInfo: String,
    dosageInfo: String,
    indications: String,
    image: String, // Packing/Product Photo (Primary)
    packshots: [String], // Array of additional photos
    vaPage: String, // Visual Aid Page (File URL)
    lblPage: String, // Label Page (File URL)
    comparisonChart: String, // Competitor Comparison Chart (File URL)
    videoUrl: String, // YouTube or Direct Link (General)
    videoDetailing: String, // Video Detailing (Direct File URL)
    pitch15s: String, // 15-sec pitch content
    pitch30s: String, // 30-sec pitch content
    documents: [{ 
        name: String, 
        data: String // Base64 or URL
    }],
    faqs: [{
        question: String,
        answer: String
    }],
    createdAt: { type: Date, default: Date.now }
});

const EmployeeSchema = new mongoose.Schema({
    empCode: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    name: String,
    active: { type: Boolean, default: true },
    machineId1: { type: String, default: null }, // Primary Device
    machineId2: { type: String, default: null }, // Secondary Device
    lastLogin: Date
});

const LoginLogSchema = new mongoose.Schema({
    empCode: String,
    name: String,
    ip: String,
    machineId: String,
    status: String, // 'Success', 'Blocked (IP)', 'Blocked (Device)', 'Failed'
    timestamp: { type: Date, default: Date.now }
});

const CompanySchema = new mongoose.Schema({
    logo: String,
    address: String,
    phone: String,
    website: String,
    tollFree: String,
    appFont: { type: String, default: "'Outfit', sans-serif" },
    updatedAt: { type: Date, default: Date.now }
});

const CategorySchema = new mongoose.Schema({
    name: { type: String, unique: true },
    active: { type: Boolean, default: true }
});

const AssessmentSchema = new mongoose.Schema({
    brand: String, // Associated brand/product name
    questions: [{
        question: String,
        options: [String],
        correctAnswer: Number // Index (0-3)
    }]
});

const UserScoreSchema = new mongoose.Schema({
    empCode: String,
    empName: String, // Added to store employee name at completion
    brand: String,
    score: Number,
    totalQuestions: Number,
    badge: String, // 'Gold', 'Silver', 'Bronze'
    completedAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', ProductSchema);
const Employee = mongoose.model('Employee', EmployeeSchema);
const Company = mongoose.model('Company', CompanySchema);
const Category = mongoose.model('Category', CategorySchema);
const LoginLog = mongoose.model('LoginLog', LoginLogSchema);
const Assessment = mongoose.model('Assessment', AssessmentSchema);
const UserScore = mongoose.model('UserScore', UserScoreSchema);

// --- API ENDPOINTS ---

// Auth
app.post('/api/auth/login', async (req, res) => {
    let { empCode, password, isAdmin } = req.body;
    if (empCode) empCode = empCode.trim();
    if (password) password = password.trim();

    // Get Client IP (Handling Render/Proxy)
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

    console.log(`[AUTH] Login Attempt - Code: "${empCode}", Admin: ${isAdmin}, IP: ${clientIP}`);

    if (isAdmin) {
        const adminId = process.env.ADMIN_ID || 'EMYRISLMS';
        const adminPass = process.env.ADMIN_PASS || 'EMYRIS_LMS';
        
        if (empCode === adminId && password === adminPass) {
            return res.json({ success: true, role: 'admin' });
        }
    } else {
        const emp = await Employee.findOne({ empCode, password });
        if (emp) {
            if (!emp.active) return res.status(403).json({ success: false, message: 'Account Deactivated' });

            // --- DUAL DEVICE LOCKING LOGIC ---
            const { machineId } = req.body;
            
            if (machineId) {
                if (!emp.machineId1) {
                    // Register first device
                    emp.machineId1 = machineId;
                    console.log(`[SECURITY] Registered Primary Machine ID for ${emp.name}: ${machineId}`);
                } else if (emp.machineId1 === machineId) {
                    // Primary device match - proceed
                } else if (!emp.machineId2) {
                    // Register second device
                    emp.machineId2 = machineId;
                    console.log(`[SECURITY] Registered Secondary Machine ID for ${emp.name}: ${machineId}`);
                } else if (emp.machineId2 === machineId) {
                    // Secondary device match - proceed
                } else {
                    // Both slots filled and none match
                    console.warn(`[SECURITY] Device Mismatch for ${emp.name}. Current: ${machineId}`);
                    await LoginLog.create({ 
                        empCode, name: emp.name, ip: clientIP, machineId, status: 'Blocked (Device Limit)' 
                    });
                    return res.status(403).json({ 
                        success: false, 
                        message: 'Unauthorized Device. Both registered slots are full. Please contact Admin.',
                        securityCode: 'DEVICE_LIMIT_EXCEEDED'
                    });
                }
            }

            emp.lastLogin = new Date();
            await emp.save();

            await LoginLog.create({ 
                empCode, 
                name: emp.name, 
                ip: clientIP, 
                machineId: machineId || 'N/A',
                status: 'Success' 
            });

            return res.json({ success: true, role: 'employee', name: emp.name, empCode: emp.empCode });
        } else {
            await LoginLog.create({ 
                empCode, 
                ip: clientIP, 
                status: 'Failed' 
            });
        }
    }
    res.status(401).json({ success: false, message: 'Invalid Credentials' });
});

app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        res.json({ success: true, product });
    } catch (e) { res.status(500).json({ success: false }); }
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
    // Migrate machineId to machineId1 if it exists as an unmapped property
    const emps = await Employee.find();
    for (let e of emps) {
        let changed = false;
        
        // Use .toObject() or access via .get() to see unmapped fields
        const raw = e.toObject({ virtuals: false });
        if (raw.machineId && !e.machineId1) {
            e.machineId1 = raw.machineId;
            e.set('machineId', undefined); // Remove old field
            changed = true;
            console.log(`[MIGRATION] Moved Machine ID for ${e.name} to Primary Slot.`);
        }

        if (e.empCode && e.empCode !== e.empCode.trim()) { e.empCode = e.empCode.trim(); changed = true; }
        if (e.password && e.password !== e.password.trim()) { e.password = e.password.trim(); changed = true; }
        if (changed) await e.save();
    }
    console.log('✨ Database Sanitized & Migrated.');
};
// sanitizeData(); // Moved to connection .then() block for stability

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

app.patch('/api/employees/:id/reset-lock', async (req, res) => {
    try {
        await Employee.findByIdAndUpdate(req.params.id, { machineId: null });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.get('/api/admin/logs', async (req, res) => {
    try {
        const logs = await LoginLog.find().sort({ timestamp: -1 }).limit(100);
        res.json({ success: true, logs });
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

// --- ASSESSMENT ENDPOINTS ---
app.get('/api/assessments', async (req, res) => {
    try {
        const assessments = await Assessment.find();
        res.json({ success: true, assessments });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.get('/api/assessments/:brand', async (req, res) => {
    try {
        const assessment = await Assessment.findOne({ brand: req.params.brand });
        res.json({ success: true, assessment });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/assessments', async (req, res) => {
    try {
        const { brand, questions } = req.body;
        await Assessment.findOneAndUpdate({ brand }, { questions }, { upsert: true });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/scores', async (req, res) => {
    try {
        const { empCode, empName, brand, score, totalQuestions } = req.body;
        let badge = 'Bronze';
        const percent = (score / totalQuestions) * 100;
        if (percent >= 90) badge = 'Gold';
        else if (percent >= 70) badge = 'Silver';
        
        const userScore = new UserScore({ empCode, empName, brand, score, totalQuestions, badge });
        await userScore.save();
        res.json({ success: true, badge });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.get('/api/scores/:empCode', async (req, res) => {
    try {
        const scores = await UserScore.find({ empCode: req.params.empCode }).sort({ completedAt: -1 });
        res.json({ success: true, scores });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.get('/api/admin/scores', async (req, res) => {
    try {
        const scores = await UserScore.find().sort({ completedAt: -1 });
        res.json({ success: true, scores });
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
