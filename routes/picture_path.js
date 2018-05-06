var express = require('express');
var router = express.Router();

var Record = require('../models/record.js');
var UrlHelper = require('../helpers/url_helper.js');
var undefsafe = require('undefsafe');


const { body,validationResult } = require('express-validator/check');
const { sanitizeBody } = require('express-validator/filter');

// First we check there is an organisation.
// If there is an org, we now the user belongs there from restrict.js
router.use(function(req, res, next) {
  if (!res.locals.organisation) {
    err = new Error('Subdomain required');
    err.status = 403;
    return next(err);
  }
  return next();
});

router.use('/id/:id', function(req, res, next) {
  Record.findById(req.params.id, res.locals.organisation._id, function(err, record) {
    if (err) return next(err);
    if (!record) {
      let error = new Error('Profile not found');
      error.status = 404;
      return next(error);
    }
    res.locals.record = record;
    next();
  });
});

//@todo deduplicate in profile.js and onboard.js
router.use(function(req, res, next) {
  if (res.locals.user.isSuperAdmin()) {
    return next();
  } else {
    let err = new Error('Forbidden Record');
    err.status = 403;
    return next(err);
  }
});

//@todo deduplicate in profile.js and onboard.js
router.use(function(req, res, next) {
  if (res.locals.record.type !== 'hashtag') {
    let err = new Error('Picture Path available for hashtags only');
    err.status = 400;
    return next(err);
  }
  return next();
});

router.use(function(req, res, next) {
  res.locals.picturePathAction = UrlHelper.makeUrl(req.organisationTag, 'picturePath/id/'+res.locals.record._id, null, req.getLocale());
  res.locals.backUrl = UrlHelper.makeUrl(req.organisationTag, 'profile/'+res.locals.record.tag, null, req.getLocale());
  return next();
});

// On post we always expect an _id field matching the record for the current user/organisation
router.post('*', function(req, res, next) {
  if (!res.locals.record._id.equals(req.body._id)) {
    err = new Error('Record Mismatch');
    err.status = 403;
    return next(err);
  }
  return next();
});

router.post('/id/:id',
  sanitizeBody('picturePath').trim().stripLow(true)
);

router.post('/id/:id',
  body('picturePath').isAscii().withMessage('Provide the picture path !')
);

router.post('/id/:id', function(req, res, next) {
  var errors = validationResult(req);
  res.locals.errors = errors.array();
  if (errors.isEmpty()) {
    res.locals.record.setPicturePath(req.body.picturePath, function(err, record) {
      if(err) return next(err);
      res.redirect(res.locals.backUrl);
    });
  } else next();
});

router.all('/id/:id', function(req, res, next) {
  res.render('picture_path', { bodyClass: 'picture-path-edit'});
});

module.exports = router;
