var mongoose = require('mongoose');
var Record = require('./record.js');

var organisationSchema = mongoose.Schema({
  name: String,
  picture: {
    url: String,
  },
  logo: {
    url: String,
  },
  tag: {type: String, index: true, unique: true},
  google: {
    hd: [String],
  },
  email: {
    domains: [String]
  },
  colors: {
    primary: [String]
  },
  tree: [[String]],
  created: { type: Date, default: Date.now },
  updated: { type: Date, default: Date.now },
  welcomed: { type: Boolean, default: false },
  public: { type: Boolean, default: false }
});

organisationSchema.virtual('host').get(function() {
  return this.tag + '.' + process.env.HOST;
});

organisationSchema.methods.needsWelcoming = function () {
  return !this.welcomed;
};

organisationSchema.methods.welcome = function(callback) {
  this.welcomed = true;
  if(callback) this.save(callback);
};

organisationSchema.methods.addGoogleHD = function(hd, callback) {
  this.google.hd.push(hd);
  if(callback) this.save(callback);
};

organisationSchema.methods.addEmailDomain = function(domain, callback) {
  this.email.domains.push(domain);
  if(callback) this.save(callback);
};

organisationSchema.methods.populateRecords = function(callback) {
  if (this.records) return callback(null, this);
  Record.find({organisation: [this.model('Organisation').getTheAllOrganisationId(), this._id] })
    .select('_id organisation tag type name description picture links within')
    .exec(function(err, records) {
      if (err) return callback(err);
      this.records = records;
      return callback(null, this);
    }.bind(this));
};

organisationSchema.statics.getTheAllOrganisation = function(callback) {
  this.findById(this.getTheAllOrganisationId(), callback);
};

organisationSchema.statics.getTheAllOrganisationId = function() {
  return process.env.THE_ALL_ORGANISATION_ID;
};

organisationSchema.statics.getTheWings = function(callback) {
  Record.findOne({organisation: this.getTheAllOrganisationId(), tag: "#wings" }, function(err, wingRecord) {
    if (err) return callback(err);
    Record.find({organisation: this.getTheAllOrganisationId(), within: wingRecord._id }, function(err, records) {
      if (err) return callback(err);
      records = records.filter(record => !record._id.equals(wingRecord._id));
      return callback(null, records);
    });
  }.bind(this));
};

var Organisation = mongoose.model('Organisation', organisationSchema);


module.exports = Organisation;
