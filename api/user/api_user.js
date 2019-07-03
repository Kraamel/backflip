var express = require('express');
var router = express.Router();
var User = require('../../models/user');
var Record = require('../../models/record');
let EmailUser = require('../../models/email/email_user');
var passport = require('passport');
require('../passport/strategy');

/**
 * @api {get} /api/users/me Get current user
 * @apiName GetCurrentUser
 * @apiGroup User
 * @apiVersion 0.9.0
 * 
 * @apiHeader {String} Authorization User 'Bearer access_token'
 * 
 * @apiSuccess {String} message User fetch with success.
 * @apiSuccess {User} user 
 * 
 * @apiError (500 Internal Server Error) InternalError Internal error
 * @apiError (400 Bad Request) BadRequest Missing parameters
 * @apiError (401 Unauthorized) InvalidGrant Invalid resource owner credentials.
 * @apiError (403 Unauthorized) Unauthorized Client id or secret invalid.
 */
router.get('/current', passport.authenticate('bearer', {session: false}), function(req, res, next) {
    return res.status(200).json({message: 'User fetch with success', user: req.user});
});

/**
 * @api {put} /api/users/:userId/organisation/:orgId Welcome user in organisation
 * @apiName UpdateUser
 * @apiGroup User
 * @apiVersion 0.9.0
 * 
 * @apiHeader {String} Authorization User 'Bearer access_token'
 * 
 * @apiSuccess {String} message User updated with success.
 * @apiSuccess {User} user User updated
 * 
 * @apiError (500 Internal Server Error) InternalError Internal error
 * @apiError (400 Bad Request) BadRequest Missing parameters
 * @apiError (401 Unauthorized) InvalidGrant Invalid resource owner credentials.
 * @apiError (403 Unauthorized) Unauthorized Client id or secret invalid. OR Your are not allowed to update this User.
 * @apiError (422 Missing Parameters) MissingParameters Missing parameters.
 */
router.put('/welcome/:userId/organisation/:orgId', passport.authenticate('bearer', {session: false}), (req, res, next) => {
  if( (!req.user._id.equals(req.params.userId)) && !req.user.isSuperAdmin())
    return res.status(403).json({message: 'Your are not allowed to update this User.'});

  User.findOne({_id: req.params.userId})
  .populate('orgsAndRecords.record', '_id name tag')
  .populate('orgsAndRecords.organisation', '_id name tag cover logo canInvite')
  .then((user) => {
    user.welcomeToOrganisation(req.params.orgId, (err, userUpdated) => {
      if(err) return res.status(404).json({message: 'User is not linked to this organisation.'});
      let orgAndRecord = user.getOrgAndRecord(req.params.orgId);
      if(orgAndRecord.record) {
        Record.findOneAndUpdate({_id: orgAndRecord.record._id}, {$set: {hidden: false}} );
        EmailUser.sendConfirmationInscriptionEmail(user, orgAndRecord.organisation, orgAndRecord.record, res);
        EmailUser.sendEmailToInvitationCodeCreator(orgAndRecord.organisation, user, orgAndRecord.record, res);

        if(orgAndRecord.organisation.canInvite) {
          var Agenda = require('../../models/agenda_scheduler');
          Agenda.scheduleSendInvitationCta(user, orgAndRecord.organisation, orgAndRecord.record);
        }
      }

      return res.status(200).json({message: 'User welcomed to organisation.', user: userUpdated});
    });
  });
});

// @todo Create validation middleware to allow the update of all the User fields.
router.put('/:userId', passport.authenticate('bearer', {session: false}), (req, res, next) => {
  if(!req.body.user) return res.status(422).json({ message: 'Missing parameter' });

  if( (!req.user._id.equals(req.params.userId)) && !req.user.isSuperAdmin())
    return res.status(403).json({message: 'Your are not allowed to update this User.'});

  let updatedFields = {locale: (req.body.user.locale || 'en')};
  User.findOneAndUpdate({_id: req.params.userId}, {$set: updatedFields}, {new: true})
  .then(userUpdated => {
    return res.status(200).json({message: 'User updated with success.', user: userUpdated});
  }).catch(e => {
    return next(e);
  });
});

/**
 * @api {put} /api/users/:userId? Update current user or other user
 * @apiName UpdateUser
 * @apiGroup User
 * @apiVersion 0.9.0
 * 
 * @apiHeader {String} Authorization User 'Bearer access_token'
 * 
 * @apiSuccess {String} message User updated with success.
 * @apiSuccess {User} user User updated
 * 
 * @apiError (500 Internal Server Error) InternalError Internal error
 * @apiError (400 Bad Request) BadRequest Missing parameters
 * @apiError (401 Unauthorized) InvalidGrant Invalid resource owner credentials.
 * @apiError (403 Unauthorized) Unauthorized Client id or secret invalid. OR Your are not allowed to update this User.
 * @apiError (422 Missing Parameters) MissingParameters Missing parameters.
 */
// router.put('/:userId?', passport.authenticate('bearer', {session: false}), function(req, res, next) {
//     if(!req.body.user) return res.status(422).json({message: 'Missing parameter'});
//     if(!req.user.isSuperAdmin() && req.params.userId) return res.status(403).json({message: 'Your are not allowed to update this User.'});

//     let userId = req.params.userId ? req.params.userId : req.user._id;
//     if(req.body.user.superadmin && !req.user.isSuperAdmin()) delete req.body.user.superadmin;

//     User.findOneAndUpdate({'_id' : userId}, {$set: req.body.user}, {new: true})
//     .then(userUpdated => {
//         if(!userUpdated) return res.status(404).json({message: 'User not found.'});
//         return res.status(200).json({message: 'User updated with success.', user: userUpdated});
//     }).catch((err) => {return next(err);});  
// });

router.use(function(err, req, res, next){
    if(err) return res.status(500).json({message: 'Internal error', errors: [err.message]});
    return res.status(500).json({message: 'Unexpected error'});
});

module.exports = router;
