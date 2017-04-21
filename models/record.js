/**
* @Author: Clément Dietschy <bedhed>
* @Date:   07-04-2017
* @Email:  clement@lenom.io
* @Project: Lenom - Backflip
* @Last modified by:   clement
* @Last modified time: 10-04-2017 05:33
* @Copyright: Clément Dietschy 2017
*/

var mongoose = require('mongoose');
var mongooseDelete = require('mongoose-delete');
var mongooseAlgolia = require('mongoose-algolia');
var linkSchema = require('./link_schema.js');
var undefsafe = require('undefsafe');


var recordSchema = mongoose.Schema({
  name: String,
  tag: String,
  type: {type: String, enum: ['person', 'team', 'hashtag']},
  organisation: {type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', default: null, index: true, required: true},
  picture: {
    url: String,
    path: String
  },
  description: {type: String, default: '#empty'},
  within: [
    {type: mongoose.Schema.Types.ObjectId, ref: 'Record', index: true}
  ],
  links: [linkSchema],
  hidden_links: [linkSchema],
  google: {
    id: {type: String, index: true},
    etag: String,
    primaryEmail: String,
    isAdmin: Boolean,
    lastLoginTime: Date,
    creationTime: Date,
    suspended: Boolean,
    customerId: String,
    orgUnitPath: String,
    includeInGlobalAddressList: Boolean,

  },
  created: { type: Date, default: Date.now },
  updated: { type: Date, default: Date.now }
});

recordSchema.virtual('ObjectID').get(function () {
  return this._id;
});

//@todo restore the unique; true condition on organisation/tag
//There's some UI needed here. Or make a different tag if needed.
recordSchema.index({'organisation': 1, 'tag': 1}/*, {unique: true}*/);
recordSchema.index({'organisation': 1, 'links.type': 1, 'links.value': 1});

recordSchema.methods.getGoogleId = function() {
  return undefsafe(this, 'google.id');
};

recordSchema.methods.isPerson = function() {
  return this.type === 'person';
};


//@todo there's a pattern break here, the links array should have been parsed by the router first
recordSchema.methods.updateLinks = function(formLinks) {
  this.links.forEach(function (link, index, links) {
    if (formLinks.some(function(formLink) {
      return link._id.equals(formLink._id) && formLink.deleted == 'true';
    })) {
      hiddenLink = this.links.splice(index, 1)[0];
      //@todo see if we can keep the same id (to infer original creation time later)
      delete hiddenLink._id;
      this.hidden_links.push(hiddenLink);
    }
  }, this);
};

recordSchema.methods.getLinkById = function(linkId) {
  return this.links.find(function (link) {
    return link._id.equals(linkId);
  });
};

// We parse the description to find @Teams, #hashtags & @persons and build the within array accordingly.
// @todo check performance of this expensive logic, if bulked there's better to do, like loading all teams & hashtags at once.
// @todo I don't want to make this a pre middleware because of performance, but maybe it should be.
recordSchema.methods.updateWithin = function(callback) {
	var regex = /([@#][\w-<>\/]+)/g;
  var tags = this.description.match(regex);
  this.newWithin = [];
  tags.forEach(function(tag) {
    this.getWithinRecordByTag(tag, function(err, record) {
      if (err) return callback(err);
      this.newWithin.push(record);
      //@todo fix this ugly way to syncrhonize a foreach
      if (tags.length === this.newWithin.length) {
        this.within = this.newWithin;
        return callback(null, this);
      }
    }.bind(this));
  }, this);
};

// @todo what if Record.within is not populated ? You're screwed aren't you ?
recordSchema.methods.getWithinRecordByTag = function(tag, callback) {
  var localRecord = this.within.find(function(record) {
    return record.tag === tag;
  });
  if (localRecord) {
    return callback(null, localRecord);
  } else {
    this.model('Record').findByTag(tag, this.organisation, function(err, distantRecord) {
      if (err) return callback(err);
      if (distantRecord) return callback(null, distantRecord);
      else this.model('Record').createByTag(tag, this.organisation, callback);
    }.bind(this));
  }
};

recordSchema.statics.findByTag = function(tag, organisationID, callback) {
  this.findOne({organisation: organisationID, tag: tag}, callback);
};

//@todo capitalize the first letter of a team's tag
recordSchema.statics.createByTag = function(tag, organisationID, callback) {
  name = tag.substr(1);
  type = tag.substr(0,1) === '@' ? 'team' : 'hashtag';
  record = new this({
    name: name,
    tag: tag,
    type: type,
    organisation: organisationID
  });
  record.save(callback);
};

recordSchema.plugin(mongooseDelete, {
  deletedAt : true,
  overrideMethods: 'all',
  validateBeforeDelete: false,
  indexFields: 'all'
});

recordSchema.plugin(mongooseAlgolia, {
  appId: process.env.ALGOLIA_APPLICATION_ID,
  apiKey: process.env.ALGOLIA_WRITE_KEY,
  indexName: 'world',
  selector: '-_id -created -updated -google -hidden_links',
  populate: {
    path: 'within',
    select: 'name tag type'
  },
  debug: true
});

var Record = mongoose.model('Record', recordSchema);

Record.validationSchema = {
  name: {
    notEmpty: {
      errorMessage: 'Name should not be empty'
    },
    isLength: {
      options: [{ min: 4, max: 64 }],
      errorMessage: 'Name should be between 4 and 64 chars long' // Error message for the validator, takes precedent over parameter message
    }
  },
  description: {
    notEmpty: {
      errorMessage: 'Story should not be empty'
    },
    isLength: {
      options: [{ min: 16, max: 2048 }],
      errorMessage: 'Description should be between 16 and 2048 chars long' // Error message for the validator, takes precedent over parameter message
    }
  }
};



module.exports = Record;
