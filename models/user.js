/**
* @Author: Clément Dietschy <bedhed>
* @Date:   15-03-2017
* @Email:  clement@lenom.io
* @Project: Lenom - Backflip
* @Last modified by:   clement
* @Last modified time: 07-04-2017 11:32
* @Copyright: Clément Dietschy 2017
*/

var mongoose = require('mongoose');

var userSchema = mongoose.Schema({
  name: String,
  picture: String,
  _orgsAndRecords: [
    {
      organisation: {type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', default: null},
      record: {type: mongoose.Schema.Types.ObjectId, ref: 'Record', default: null}
    }
  ],
  locale: {type: String, default: 'en' },
  google: {
    id: {type: String, index: true, unique: true},
    email: String,
    hd: String,
    tokens: {
      id_token: String,
      refresh_token: String
    },
  },
  last_login: { type: Date },
  created: { type: Date, default: Date.now },
  updated: { type: Date, default: Date.now },
  welcomed: { type: Boolean, default: false }
});

userSchema.methods.touchLogin = function (callback) {
  this.last_login = Date.now();
  this.save(callback);
};

userSchema.methods.needsWelcoming = function () {
  return !this.welcomed;
};

userSchema.methods.hasOrganisation = function() {
  return this._orgsAndRecords.length > 0;
};

userSchema.methods.belongsToOrganisation = function(organisationID) {
  this._orgsAndRecords.some(function(orgAndRecord) {
      return orgAndRecord.organisation._id === organisationID;
  });
};

var User = mongoose.model('User', userSchema);



module.exports = User;
