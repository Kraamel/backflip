var express = require('express');
var router = express.Router();
var authorization = require('../mid_authorization_organisation');
var EmailUser = require('../../models/email/email_user');
var User = require('../../models/user');
var EmailHelper = require('../../helpers/email_helper.js');
var UrlHelper = require('../../helpers/url_helper');

var passport = require('passport');
require('../passport/strategy');

/**
 * @description Send an email to inform the User that his account is link to an Integration.
 */
router.post('/security/integration/:integrationName', passport.authenticate('bearer', {session: false}), (req, res, next) => {
    let accessToken = (req.headers.authorization.split('Bearer ').length > 1 ? req.headers.authorization.split('Bearer ')[1] : null);

    EmailUser.sendNewIntegrationEmail(req.user, req.params.integrationName, accessToken,  res)
    .then(() => {
        return res.status(200).json({message: 'Email sent with success.'});
    }).catch(err => next(err));
});

// for the moment, confirm the login email of the user
router.post('/confirmation/:orgTag?', passport.authenticate('bearer', {session: false}), (req, res, next) => {
    EmailUser.sendEmailConfirmation(req.user, res, req.params.orgTag)
    .then(()=>{
        return res.status(200).json({message: 'Email sent with success.'});
    }).catch((err)=>{return next(err);});
});

// @todo Should not be inside API, this is not an API route.
// @todo Should handle the error for the User.
router.get('/confirmation/callback/:token/:hash', (req, res, next) => {
    EmailUser.login(req.params.hash, req.params.token, function(err, user){
        if(err) return next(err);
        if(user.email.validated) return res.redirect(new UrlHelper(req.organisationTag, 'login/callback', null, req.getLocale()).getUrl());
        res.locals.user = user;
        req.session.user = user;
        user.email.validated = true;
        User.updateOne({'_id': user._id}, {$set: {email : user.email}})
        .then(() => {
            // In order to perform transition backflip -> frontflip, we redirect to backflip here.
            // return res.redirect( 'https://' + process.env.HOST_FRONTFLIP + '/redirect');
            return res.redirect(new UrlHelper(req.organisationTag, 'login/callback', null, req.getLocale()).getUrl());
        }).catch((err) => {
            return next(err);
        });
    });
});

router.post('/password', (req, res, next) => {
    if(!req.body.userEmail) return res.status(422).send({message: 'Missing parameter : userEmail'});
    User.findOne({'email.normalized': User.normalizeEmail(req.body.userEmail)})
    .then((user) => {
        if(!user) return res.status(404).send({message: 'User not found with this email : ' + req.body.userEmail});
        EmailUser.sendPasswordRecoveryEmail(user, req.getLocale(), res)
        .then(() => {
            return res.status(200).json({message: 'Email send with success.'});
        }).catch((err)=>{return next(err);});
    }).catch((err)=>{return next(err);});
});

/*eslint-disable */
router.post('/invitation/code/confirmation', passport.authenticate('bearer', {session: false}), (req, res, next) => {
  EmailHelper.public.emailConfirmationInvitation(req.user.loginEmail, res)
    .then(() => {
      return res.status(200).json({message: 'Email send with success.'});
    }).catch((err) => {
    console.log('error: ' + err);
    return next(err);
  });
});
/*eslint-enable */

router.use(function(err, req, res, next){
    if(err) return res.status(500).json({message: 'Internal error', errors: [err.message]});
    return res.status(500).json({message: 'Unexpected error'});
});

module.exports = router;
