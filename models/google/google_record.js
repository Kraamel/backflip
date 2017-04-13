/**
* @Author: Clément Dietschy <bedhed>
* @Date:   13-04-2017
* @Email:  clement@lenom.io
* @Project: Lenom - Backflip
* @Last modified by:   clement
* @Last modified time: 08-04-2017 09:41
* @Copyright: Clément Dietschy 2017
*/

var Record = require('../record.js');

// This is more an helper than a model.
// @todo move somewhere else.

var GoogleRecord = {};

GoogleRecord.filterActive = function(googleUsers) {
  return googleUsers.filter(this.isActive);
};

GoogleRecord.isActive = function(googleUser) {
  return !googleUser.suspended;
};

GoogleRecord.buildRecords = function(googleUsers, organisationID) {
  var records = [];
  this.filterActive(googleUsers).forEach(function (googleUser) {
    records.push(GoogleRecord.buildRecord(googleUser, organisationID));
  });
  return records;
};

GoogleRecord.buildRecord = function(googleUser, organisationID) {
  return new Record({
      name: googleUser.name.fullName,
      tag: this.makeTag(googleUser),
      type: 'person',
      organisation: organisationID,
      picture: {
        uri: googleUser.thumbnailPhotoUrl
      },
      links: GoogleRecord.makeLinks(googleUser),
  });
};

GoogleRecord.makeTag = function(googleUser) {
  return googleUser.primaryEmail.split('@')[0];
};


// This is some very important logic: understanding the structure & content of a GoogleUser
// And converting this into our own Record.
// This could be several little workers taking care of 1 type of field each.
GoogleRecord.makeLinks = function(googleUser) {
  var links = [];
  links.push({
    type: 'googleId',
    identifier: true,
    value: googleUser.id,
    target: 'system'
  });
  googleUser.emails.forEach(function(emailObject) {
    links.push({
      type: 'email',
      identifier: true,
      value: emailObject.address,
      target: 'organisation'
    });
  });
  if (googleUser.aliases)
    googleUser.aliases.forEach(function(alias) {
      links.push({
        type: 'email',
        identifier: true,
        value: alias,
        target: 'private'
      });
    });
  if (googleUser.nonEditableAliases)
    googleUser.nonEditableAliases.forEach(function(alias) {
      links.push({
        type: 'email',
        identifier: true,
        value: alias,
        target: 'system'
      });
    });
    if (googleUser.addresses)
      googleUser.addresses.forEach(function(addressObject) {
        links.push({
          type: 'address',
          identifier: false,
          value: addressObject.formatted,
          target: (addressObject.type == 'work') ? 'organisation' : 'private'
        });
      });
      if (googleUser.phones)
        googleUser.phones.forEach(function(phoneObject) {
          links.push({
            type: 'phone',
            identifier: false,
            value: phoneObject.value,
            target: (phoneObject.type == 'work') ? 'organisation' : 'private'
          });
        });
  return links;
};

module.exports = GoogleRecord;
