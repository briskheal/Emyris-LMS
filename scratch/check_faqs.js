const mongoose = require('mongoose');
require('dotenv').config();

const ProductSchema = new mongoose.Schema({
    title: String,
    faqs: [{ question: String, answer: String }]
});
const Product = mongoose.model('Product', ProductSchema);

async function checkFaqs() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/emyris_lms');
    const products = await Product.find({});
    console.log('--- PRODUCT FAQ CHECK ---');
    products.forEach(p => {
        console.log(`Product: ${p.title} (${p._id})`);
        console.log(`FAQs Count: ${p.faqs ? p.faqs.length : 0}`);
        if (p.faqs && p.faqs.length > 0) {
            p.faqs.forEach((f, i) => {
                console.log(`  [${i}] Q: ${f.question}`);
            });
        }
        console.log('-------------------------');
    });
    process.exit();
}

checkFaqs();
