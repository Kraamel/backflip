var express = require('express');
var router = express.Router();
var authorization = require('../mid_authorization_profile');
let Record = require('../../models/record');
let validate_record = require('../validate_record');
var GoogleRecord = require('../../models/google/google_record.js');
var User = require('../../models/user');
var Organisation = require('../../models/organisation');
var LinkHelper = require('../../helpers/link_helper');
var LinkedinUserHelper = require('../../helpers/linkedinUser_helper');
var GoogleUserHelper = require('../../helpers/googleUser_helper');
var uppercamelcase = require('uppercamelcase');
var slug = require('slug');
var passport = require('passport');
require('../passport/strategy');

let asyncForEach = async (array, callback) => {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

router.put('/superadmin/:recordIdFrom/merge/:recordIdTo', passport.authenticate('bearer', { session: false }), async (req, res, next) => {
  if (!req.user.isSuperAdmin()) return res.status(403).json({ message: 'This is a restricted route.' });
  if(!req.body.orgId) return res.status(422).json({message: 'The body param : <orgId> is required.'});

  var fromRecord = await Record.findByIdAsync(req.params.recordIdFrom, req.body.orgId);
  var toRecord = await Record.findByIdAsync(req.params.recordIdTo, req.body.orgId);

  if(!fromRecord || !toRecord) return res.status(404).json({message: "We cant't find these records. Please, check the ids provided."})

  var recordsUsingFromRecord = await Record.find({hashtags: fromRecord._id})  
                              .populate('hashtags', '_id tag type name name_translated picture')
                              .populate('within', '_id tag type name name_translated picture')
                              .then(recs => {return recs});

  await asyncForEach(recordsUsingFromRecord, async (record) => {

    // find index of from record in current record hashtags
    var indexOfFromRecord = record.hashtags.findIndex(hashtag => hashtag.tag === fromRecord.tag);

    // Update record hashtags if it doesn't already contains toRecord
    if(record.hashtags.findIndex(hashtag => hashtag.tag === toRecord.tag) === -1) {
      record.hashtags[indexOfFromRecord] = toRecord;
    } else {
      record.hashtags.splice(indexOfFromRecord, 1);
    }
    await Record.updateOne({_id: record._id}, {$set: {hashtags: record.hashtags}}, { new: true });
  });

  // Remove "from record"
  fromRecord.delete(req.user._id, function(err) {
    if(err) console.log(err);
    return res.status(200).json(
      {
        message: 'Records merge with success.', 
        fromRecord: fromRecord, 
        toRecord: toRecord, 
        recordsUpdatedCount: recordsUsingFromRecord.length, 
        recordsUpdated: recordsUsingFromRecord
      }
    );
  });

});

/**
 * @description Sync all records of Wingzy to Algolia
 */
router.get('/superadmin/sync/algolia/all', passport.authenticate('bearer', { session: false }), (req, res, next) => {
  if (!req.user.isSuperAdmin()) return res.status(403).json({ message: 'This is a restricted route.' });
  var recordsUpdated = 0;

  Record.find()
  .populate('hashtags', '_id tag type name name_translated picture')
  .populate('within', '_id tag type name name_translated picture')
  .then(async records => {

    await asyncForEach(records, async (record) => {
      recordsUpdated++;
      record.save();
    });

    return res.status(200).json({ message: 'Records sync with Algolia.', recordsUpdated: recordsUpdated });

  }).catch((e) => { return next(e); });

});

// Get profile by his tag
// Modify authorization to allow profileTag
router.get('/tag/:profileTag/organisation/:organisationId', passport.authenticate('bearer', { session: false }), authorization, (req, res, next) => {
  Record.findOne({ 'tag': req.params.profileTag, 'organisation': [Record.getTheAllOrganisationId(), req.organisation._id] })
    .populate('hashtags', '_id tag type name name_translated picture')
    .populate('within', '_id tag type name name_translated picture')
    .then(record => {
      if (!record) return res.status(404).json({ message: 'Record not found.' });

      return res.status(200).json({ message: 'Record fetch with success.', record: record });
    }).catch((err) => { return next(err); });
});

// Insert or Update an array of Record.
// @todo Write API doc
// /api/profiles/bulk
router.post('/bulk', passport.authenticate('bearer', { session: false }), (req, res, next) => {
  if (!req.user.isSuperAdmin()) return res.status(403).json({ message: 'This is a restricted route.' });

  // need parsing because Google sheet script send body as a string object
  req.body.records = JSON.parse(req.body.records);

  req.body.records.forEach(recordObject => {
    let recordToUpdate = new Record(recordObject);
    if (recordObject._id) {
      delete recordToUpdate._id;
      Record.findByIdAndUpdate(recordObject._id, recordToUpdate);
    } else {
      recordToUpdate.tag = Record.getTagFromEmail(recordToUpdate.links.find(link => link.type === 'email').value);
      if (recordToUpdate.picture && recordToUpdate.picture.url) {
        recordToUpdate.addPictureByUrl(recordToUpdate.picture.url, function (err, data) {
          recordToUpdate.save();
        });
      } else {
        recordToUpdate.save();
      }
    }
  });
  return res.status(200).json({ message: 'Request received and process has started' });
});

// @todo Validate the new link
// @todo Will be deleted ?
router.put('/:profileId/addLink', passport.authenticate('bearer', { session: false }), authorization, (req, res, next) => {
  if (req.user.isSuperAdmin()) {
    Record.findOne({ '_id': req.params.profileId, 'organisation': req.organisation._id })
      .populate('hashtags', '_id tag type name name_translated picture')
      .populate('within', '_id tag type name name_translated picture')
      .then(record => {
        if (!record) return res.status(404).json({ message: 'Record not found.' });
        record.addLink(req.body.link);
        record.save()
          .then(() => {
            return res.status(200).json({ message: 'Record updated with success.', record: record });
          }).catch((err) => { return next(err); });

      }).catch((err) => { return next(err); });
  } else {
    return res.status(403).json({ message: 'This is a restricted route.' });
  }
});

// @todo Remove route and open a route /api/organisations/ => get all in org (superadmin)
router.post('/workplace/:workplaceId', passport.authenticate('bearer', { session: false }), authorization, (req, res, next) => {
  Record.findOne({ organisation: req.organisation._id, 'links': { $elemMatch: { value: req.params.workplaceId, type: 'workplace' } } })
    .then(record => {
      if (!record) return res.status(404).json({ message: 'Record not found.' });
      return res.status(200).json({ message: 'Record fetch with success.', record: record });
    }).catch((err) => { return next(err); });
});

// Get the best record possible for an user
router.get('/user/:userId/organisation/:orgId', passport.authenticate('bearer', { session: false }), authorization, async (req, res, next) => {
  try {
    let currentRecord, currentUser;
    let orgId = req.params.orgId;
    let authorizationHeader = req.headers.authorization;
    let accessToken = (authorizationHeader.split('Bearer ').length > 1 ? authorizationHeader.split('Bearer ')[1] : null);

    // Init working user
    if (!req.user._id.equals(req.params.userId)) {
      if (!req.user.isSuperAdmin()) return res.status(403).json({ message: 'Unauthorized' });
      currentUser = await User.findById(req.params.userId).exec();
    } else {
      currentUser = req.user;
    }

    // Try to get record by user
    if (req.user.getRecordIdByOrgId(orgId))
      currentRecord = await new Promise((resolve, reject) => Record.findById(currentUser.getRecordIdByOrgId(orgId), orgId, (err, record) => resolve(record)));

    // Try to get record by email
    if (!currentRecord)
      currentRecord = await new Promise((resolve, reject) => Record.findByEmail(currentUser.loginEmail, orgId, (err, record) => resolve(record)));

    // Try to get record by Google id
    if (!currentRecord && currentUser.google && currentUser.google.id)
      currentRecord = await new Promise((resolve, reject) => GoogleRecord.getByGoogleId(currentUser.google.id, orgId, (err, record) => resolve(record)));

    if(!currentRecord && currentUser.googleUser)
      currentRecord = await new Promise((resolve, reject) => GoogleUserHelper.getGoogleRecord(accessToken, orgId)
      .then(record => resolve(record))
      .catch(error => {console.log('error: ' + JSON.stringify(error)); resolve(null);  }));

    // Try to get record by LinkedIn
    if (!currentRecord && currentUser.linkedinUser)
      currentRecord = await new Promise((resolve, reject) => LinkedinUserHelper.getLinkedinRecord(accessToken, orgId)
        .then(record => resolve(record))
        .catch(error => {console.log('error: ' + JSON.stringify(error)); resolve(null);  } ));

    if (!currentRecord) {
      currentRecord = Record.makeFromEmail(currentUser.loginEmail, orgId);
      await currentRecord.save();
    }

    // Attach record to user
    if (currentRecord) {
      currentUser.attachOrgAndRecord({ _id: orgId }, currentRecord);
      let currentUserId = currentUser._id;
      delete currentUser._id;
      await User.findOneAndUpdate({ _id: currentUserId }, currentUser).then().catch(err => next(err));
      return res.status(200).json({ message: 'Record fetch with success.', record: currentRecord });
    } else {
      return res.status(404).json({ message: 'Record not found.' });
    }
  } catch (err) {
    return next(err);
  }
});


// Get all Wings
router.get('/superadmin/wings/all', passport.authenticate('bearer', { session: false }), authorization, function (req, res, next) {
  if (!req.user.isSuperAdmin()) return res.status(403).json({ message: 'This is a restricted route.' });

  Record.find({ type: 'hashtag' })
    .populate('organisation', '_id name tag public premium')
    .populate('hashtags', '_id tag type name name_translated picture')
    .then(records => {
      return res.status(200).json({ message: 'Records fetch with success.', records: records });
    }).catch((err) => { return next(err); });
});

// Count Wings occurrence
router.get('/superadmin/wings/:wingsId/count', passport.authenticate('bearer', { session: false }), authorization, function (req, res, next) {
  if (!req.user.isSuperAdmin()) return res.status(403).json({ message: 'This is a restricted route.' });
  if (!req.params.wingsId) return res.status(422).json({ message: 'Missing parameter.' });

  Record.find({ hashtags: req.params.wingsId })
    .then(records => {
      return res.status(200).json({ message: 'Request made with success.', occurrence: records.length });
    }).catch((err) => { return next(err); });
});

/**
 * @api {get} /api/profiles/:profileId Get Record
 * @apiName GetRecord
 * @apiGroup Record
 * @apiVersion 0.9.0
 * 
 * @apiHeader {String} Authorization User 'Bearer access_token'
 * @apiParam {String} profileId Id of the Record (person or hashtag)
 * @apiParam {String} orgId Id of the Organisation (Body parameter)
 *  
 * @apiSuccess {String} message Record fetch with success.
 * @apiSuccess {Record} record Record object
 * 
 * @apiError (500 Internal Server Error) InternalError Internal error
 * @apiError (404 Not Found) RecordNotFound Record not found. OR Organisation not found.
 * @apiError (401 Unauthorized) InvalidGrant Invalid resource owner credentials.
 * @apiError (403 Unauthorized) Unauthorized Client id or secret invalid. OR You haven't access to this Organisation.
 * @apiError (422 Missing Parameter) Missing parameter
 */
router.get('/:profileId', passport.authenticate('bearer', { session: false }), authorization, function (req, res, next) {
  Record.findOne({ '_id': req.params.profileId, 'organisation': req.organisation._id })
    .populate('hashtags', '_id tag type name name_translated picture')
    .populate('within', '_id tag type name name_translated picture')
    .then(record => {
      if (!record) return res.status(404).json({ message: 'Record not found.' });
      return res.status(200).json({ message: 'Record fetch with success.', record: record });
    }).catch((err) => { return next(err); });
});

/**
 * @api {post} /api/profiles/ Post new Record
 * @apiName PostRecord
 * @apiGroup Record
 * @apiVersion 0.9.0
 * 
 * @apiHeader {String} Authorization User 'Bearer access_token'
 * @apiParam {Record} Record to post
 * @apiParam {String} orgId Id of the Organisation (Body parameter)
 *  
 * @apiSuccess {String} message Record fetch with success.
 * @apiSuccess {Record} record Record object
 * 
 * @apiError (500 Internal Server Error) InternalError Internal error
 * @apiError (404 Not Found) RecordNotFound Record not found. OR Organisation not found.
 * @apiError (401 Unauthorized) InvalidGrant Invalid resource owner credentials.
 * @apiError (403 Unauthorized) Unauthorized Client id or secret invalid. OR You haven't access to this Organisation.
 * @apiError (422 Missing Parameter) Missing parameter
 */
router.post('/', passport.authenticate('bearer', { session: false }), authorization, validate_record, function (req, res, next) {
  let record = req.body.record;
  if (!record) return res.status(422).json({ message: 'Missing parameter' });
  if (!record.tag && record.name) {
    if (record.type === 'person') {
      record.tag = '@' + slug(uppercamelcase(record.name));
    } else {
      record.tag = '#' + slug(uppercamelcase(record.name));
    }
  }

  Record.makeFromTagAsync(record.tag, req.organisation._id)
    .then(recordSaved => {
      record.tag = recordSaved.tag; // tag can be modify
      record.name = record.name || recordSaved.name;
      Record.findOneAndUpdate({ '_id': recordSaved._id }, { $set: record }, { new: true })
        .then(recordUpdated => {
          Record.findOne({ _id: recordUpdated._id })
            .populate('hashtags', '_id tag type name name_translated picture')
            .populate('within', '_id tag type name name_translated picture')
            .then(recordPopulated => {
              return res.status(200).json({ message: 'Record saved.', record: recordPopulated });
            });
        }).catch((err) => { return next(err); });

    }).catch(err => {
      return res.status(400).json({ message: 'An error occurred during object saving.', err: [err.message] });
    });
});

/**
 * @api {put} /api/profiles/:profileId Update Record
 * @apiName PutRecord
 * @apiGroup Record
 * @apiVersion 0.9.0
 * 
 * @apiHeader {String} Authorization User 'Bearer access_token'
 * @apiParam {Record} Record to update
 * @apiParam {String} profileId Id of the Record (person or hashtag)
 * @apiParam {String} orgId Id of the Organisation (Body parameter)
 *  
 * @apiSuccess {String} message Record fetch with success.
 * @apiSuccess {Record} record Record object
 * 
 * @apiError (500 Internal Server Error) InternalError Internal error
 * @apiError (404 Not Found) RecordNotFound Record not found. OR Organisation not found.
 * @apiError (401 Unauthorized) InvalidGrant Invalid resource owner credentials.
 * @apiError (403 Unauthorized) Unauthorized Client id or secret invalid. OR You haven't access to this Organisation.
 * @apiError (422 Missing Parameter) Missing parameter
 */
router.put('/:profileId', passport.authenticate('bearer', { session: false }), authorization, validate_record, function (req, res, next) {
  let recordToUpdate = req.body.record;
  let recordType = new Record(recordToUpdate);

  if (!recordToUpdate) return res.status(422).json({ message: 'Missing parameter' });

  if (recordToUpdate.links) {
    var links = [];
    recordType.links.forEach(function (link, index) {
      if (link.value)
        links.push(LinkHelper.makeLink(link.value, link.type));
    });
    recordType.makeLinks(links);
    recordToUpdate.links = recordType.links;
  }



  Record.findOneAndUpdate({ '_id': req.params.profileId, 'organisation': req.organisation._id }, { $set: recordToUpdate }, { new: true })
    .then(recordUpdated => {
      if (!recordUpdated) return res.status(404).json({ message: 'Record not found.' });

      Record.findOne({ '_id': recordUpdated._id, 'organisation': req.organisation._id })
        .populate('hashtags', '_id tag type name name_translated picture')
        .populate('within', '_id tag type name name_translated picture')
        .then(recordUpdated => {
          if (recordToUpdate.picture && recordToUpdate.picture.url) {
            recordUpdated.addPictureByUrlAsync(recordToUpdate.picture.url)
              .then(pictureField => {
                recordUpdated.picture = pictureField.picture;
                recordUpdated.save().then((recordUpdatedBis) => {
                  return res.status(200).json({ message: 'Record updated with success.', record: recordUpdatedBis });
                }).catch((err) => { return next(err); });
              })
          } else {
            return res.status(200).json({ message: 'Record updated with success.', record: recordUpdated });
          }
        });

    }).catch((err) => { return next(err); });
});

/**
 * @api {delete} /api/profiles/:profileId Delete Record
 * @apiName DeleteRecord
 * @apiGroup Record
 * @apiVersion 0.9.0
 * 
 * @apiHeader {String} Authorization User 'Bearer access_token'
 * @apiParam {String} profileId Id of the Record (person or hashtag)
 * @apiParam {String} orgId Id of the Organisation (Body parameter)
 *  
 * @apiSuccess {String} message Record fetch with success.
 * @apiSuccess {Record} record Record object
 * 
 * @apiError (500 Internal Server Error) InternalError Internal error
 * @apiError (404 Not Found) RecordNotFound Record not found. OR Organisation not found.
 * @apiError (401 Unauthorized) InvalidGrant Invalid resource owner credentials.
 * @apiError (403 Unauthorized) Unauthorized Client id or secret invalid. OR You haven't access to this Organisation. OR You can't delete this profile.
 * @apiError (422 Missing Parameter) Missing parameter
 */
router.delete('/:profileId', passport.authenticate('bearer', { session: false }), authorization, function (req, res, next) {
  Record.findOne({ '_id': req.params.profileId, 'organisation': req.organisation._id })
    .then(record => {
      if (!record) return res.status(404).json({ message: 'Record not found.' });

      // An user only can deleted his profile.
      if (req.user.getOrgAndRecord(req.organisation._id).record._id.equals(record._id) || req.user.isSuperAdmin()) {
        Record.deleteOne({ '_id': record._id })
          .then(() => {
            return res.status(200).json({ message: 'Record deleted with success.', record: record });
          }).catch((err) => { return next(err); });
      } else {
        return res.status(403).json({ message: 'You can\'t delete this profile.' });
      }
    }).catch((err) => { return next(err); });
});

router.use(function (err, req, res, next) {
  console.error(err);
  if (err) return res.status(500).json({ message: 'Internal error', errors: [err.message] });
  return res.status(500).json({ message: 'Unexpected error' });
});

module.exports = router;
