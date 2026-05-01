const mongoose = require('mongoose');
require('dotenv').config();

const ProductSchema = new mongoose.Schema({
    title: String,
    faqs: [{ question: String, answer: String }]
});
const Product = mongoose.model('Product', ProductSchema);

async function fixDmFaqs() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/emyris_lms');
    
    // Find DM and HP
    const dm = await Product.findOne({ title: /ALOMOS DM/i });
    
    if (dm) {
        console.log(`Found product: ${dm.title}`);
        console.log(`Current FAQ count: ${dm.faqs.length}`);
        
        // Clear the FAQs for DM as they were likely leaked from HP
        dm.faqs = [];
        await dm.save();
        console.log(`✅ FAQs for ${dm.title} have been cleared. You can now add correct FAQs from the Admin Hub.`);
    } else {
        console.log('Product "ALOMOS DM" not found.');
    }
    
    process.exit();
}

fixDmFaqs();
