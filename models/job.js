var mongoose = require('mongoose');

var jobSchema = mongoose.Schema({
    name: String,
    type: String,
    nextRunAt: Date,
    date : {
        user: {type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null},
        sender: {type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null},
        organisation: {type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', default: null},
        locale: String
    }
});

let Job = mongoose.model('Job', jobSchema);
module.exports = Job;
