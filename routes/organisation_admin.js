var express = require('express');
var router = express.Router();
var UrlHelper = require('../helpers/url_helper.js');
var undefsafe = require('undefsafe');

const { body,validationResult } = require('express-validator/check');
const { sanitizeBody } = require('express-validator/filter');

router.get('/makePublic', function(req, res, next) {
  res.locals.organisation.makePublic(function(err, organisation) {
    res.render('index', {
      title: 'Organisation made Public',
      content: organisation
    });
  });
});

router.get('/createLink', function(req, res, next) {
  res.locals.organisation.addCode(null, null, res.locals.user, function(err, organisation) {
    if (err) return next(err);
    var code = organisation.codes[0].value;
    var endDate = organisation.codes[0].ends;
  var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return res.render('index',
      {
        title: req.__('Invitation code created'),
        details:  req.__('Anyone can now join {{{organisation}}} with link<br/><strong>{{link}}</strong><br/>It is valid until {{endDate}}.',
          {
            organisation: res.locals.organisation.name,
            link: UrlHelper.makeUrl(organisation.tag, 'login', '?code='+code, req.getLocale()),
            endDate: new Intl.DateTimeFormat(req.getLocale(), options).format(endDate)
          }
        ),
        content: res.locals.user.isSuperAdmin() ? organisation : null
      }
    );
  });
});

router.use(function(req, res, next) {
  res.locals.formAction = UrlHelper.makeUrl(req.organisationTag, 'admin/organisation/', null, req.getLocale());
  res.locals.backUrl = UrlHelper.makeUrl(req.organisationTag, null, null, req.getLocale());
  return next();
});

// On post we always expect an _id field matching the record for the current user/organisation
router.post('*', function(req, res, next) {
  if (!res.locals.organisation._id.equals(req.body._id)) {
    err = new Error('Organisation Mismatch');
    err.status = 403;
    return next(err);
  }
  return next();
});

router.post('/',
  sanitizeBody('tag').trim().escape().stripLow(true),
  sanitizeBody('name').trim().escape().stripLow(true),
  sanitizeBody('logo').trim().escape().stripLow(true),
  sanitizeBody('cover').trim().escape().stripLow(true),
  sanitizeBody('css').trim().escape().stripLow(true)
);

router.post('/',
  body('tag').matches(/^[a-z0-9\-]*$/).withMessage((value, {req}) => {
    return req.__('Please provide a valid tag.');
  }),
  body('name').isLength({ min: 3 }).withMessage((value, {req}) => {
    return req.__('Please provide a valid name.');
  }),
  body('css').isLength({ max: 1280 }).withMessage((value, {req}) => {
    return req.__('{{field}} Cannot be longer than {{length}} characters', {field: 'CSS', length: 1280});
  }),
  body('logo.url').isURL().optional({checkFalsy:true}).withMessage((value, {req}) => {
    return req.__('Please provide a valid {{field}} URL.', {field: 'Logo'});
  }),
  body('cover.url').isURL().optional({checkFalsy:true}).withMessage((value, {req}) => {
    return req.__('Please provide a valid {{field}} URL.', {field: 'Cover'});
  })
);

router.post('/', function(req, res, next) {
  var errors = validationResult(req);
  res.locals.errors = errors.array();
  if (res.locals.user.isSuperAdmin()) res.locals.organisation.tag = req.body.tag;
  res.locals.organisation.name = req.body.name;
  res.locals.organisation.logo.url = req.body.logo.url;
  res.locals.organisation.cover.url = req.body.cover.url;
  res.locals.organisation.canInvite = req.body.canInvite;
  res.locals.organisation.style.css = req.body.css;
  if (errors.isEmpty()) {
    res.locals.organisation.save(function(err, organisation) {
      if(err) return next(err);
      res.redirect(UrlHelper.makeUrl(organisation.tag, null, null, req.getLocale()));
    });
  } else next();
});

router.all('/', function(req, res, next) {
  res.locals.uploadcarePublicKey = process.env.UPLOADCARE_PUBLIC_KEY;
  res.render('admin/organisation', { bodyClass: 'admin'});
});

module.exports = router;
