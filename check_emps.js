const mongoose = require('mongoose');
const uri = 'mongodb+srv://impdaysaap:RPykhDyaiPDFwSJi@cluster0.cquys3i.mongodb.net/emyris_lms?retryWrites=true&w=majority&appName=Cluster0';

const EmployeeSchema = new mongoose.Schema({
    name: String,
    empCode: String,
    password: String,
    active: { type: Boolean, default: true }
});

const Employee = mongoose.model('Employee', EmployeeSchema);

async function check() {
    await mongoose.connect(uri);
    const emps = await Employee.find({});
    console.log('--- Employee Records ---');
    emps.forEach(e => {
        console.log(`Name: ${e.name} | Code: ${e.empCode} | Pass: ${e.password} | Active: ${e.active}`);
    });
    process.exit();
}
check();
