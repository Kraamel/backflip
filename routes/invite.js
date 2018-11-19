var express = require('express');
var router = express.Router();
var undefsafe = require('undefsafe');

const { body,validationResult} = require('express-validator/check');
const { sanitizeBody } = require('express-validator/filter');

var User = require('../models/user.js');
var Record = require('../models/record.js');
var EmailUser = require('../models/email/email_user.js');
var UrlHelper = require('../helpers/url_helper.js');

// global const
const CUSTOM_MESSAGE_LENGTH_MIN = 10; //min size of a custom invitation message.

router.use(function(req, res, next) {
  if (res.locals.organisation.canInvite || res.locals.user.isAdminToOrganisation(res.locals.organisation._id) || res.locals.user.isSuperAdmin()) return next();

  err = new Error('Invitation Forbidden');
  err.status = 403;
  return next(err);
});

router.use(function(req, res, next) {
  res.locals.formAction = UrlHelper.makeUrl(res.locals.organisation.tag, 'invite', null, req.getLocale());
  res.locals.skipUrl = UrlHelper.makeUrl(res.locals.organisation.tag, null, null, req.getLocale());
  res.locals.textPlaceholder = res.__("Hello!\r\n \r\nI am on the Wingzy for %s, an intuitive app to find each other according to what we love and know.", 
                        res.locals.organisation.name);
  return next();
});

// sanitize emails data
router.post('/',
  sanitizeBody('emails.0').trim().escape().stripLow(true)
);

// remove space from emails data and create array of emails
router.post('/', function(req, res, next){
  req.body.emails[0] = req.body.emails[0].split(' ').join('');
  req.body.emails = req.body.emails[0].split(',');
  return next();
});

//@todo validate the array of emails, not only the first one.
router.post('/',
  body('emails').isEmail().withMessage((value, {req}) => {
    return req.__('{{email}} does not seem right, could you try again please?', {email: value});
  })
);

router.post('/', function(req, res, next) {
  var errors = validationResult(req);
  res.locals.errors = errors.array() || [];
  if (errors.isEmpty()) {
    var count = 0;
    res.locals.successes = [];
    req.body.customMessage = req.body.customMessage.replace(/\r\n|\r|\n/g, '<br/>');
    req.body.emails.forEach(email => {
      if (email) {
        email = email.trim();
        User.findOneByEmail(email, function(err, user) {
          if (err) return next(err);
          if (!user) {
            user = EmailUser.newFromEmail(email);
          }
          if (!user.canEmailSignin()) {
            EmailUser.addStrategy(email, user);
          }
          user.attachOrgAndRecord(res.locals.organisation, null, function(err, user) {
            if (err) return next(err);
            EmailUser.sendInviteEmail(user, res.locals.user, res.locals.organisation,
            req.body.customMessage.length > CUSTOM_MESSAGE_LENGTH_MIN ? req.body.customMessage : null, res, function(err, user) {
              if (err) return next(err);
              res.locals.successes.push(
                {
                  msg: req.__('An invitation has been sent to {{email}}', {email: email})
                }
              );
              count ++;
              if (count === req.body.emails.length) return res.redirect(res.locals.skipUrl);
            });
          });
        });
      } else {
        count ++;
        if (count === req.body.emails.length) return res.redirect(res.locals.skipUrl);
      }
    });
  } else {
    res.locals.emails = req.body.emails;
    return next();
  }
});

router.all('/', function(req, res, next) {
  res.render('invite', {bodyClass: 'onboard invite'});
});

module.exports = router;
