var express = require('express');
var router = express.Router();
var undefsafe = require('undefsafe');
var parseDomain = require('parse-domain');
var uploadcare = require('uploadcare')(process.env.UPLOADCARE_PUBLIC_KEY, process.env.UPLOADCARE_PRIVATE_KEY);

const { body,validationResult } = require('express-validator/check');
const { sanitizeBody } = require('express-validator/filter');

var Record = require('../models/record.js');
var Organisation = require('../models/organisation.js');
var AlgoliaOrganisation = require('../models/algolia/algolia_organisation.js');
var UrlHelper = require('../helpers/url_helper.js');
var FullContact = require('../models/fullcontact/fullcontact.js');
var LinkHelper = require('../helpers/link_helper.js');
var ErrorsMonitoringHelper = require('../helpers/errors_monitoring_helper');

router.use(function(req, res, next) {
  var query = null;
  if (req.query.recordId) {
    query = `?recordId=${req.query.recordId}`;
  } else if (req.query.first) {
    query = `?first=true`;
  }
  res.locals.onboard = {
    welcomeAction: new UrlHelper(req.organisationTag, 'onboard/welcome', query, req.getLocale()).getUrl(),
    introAction: new UrlHelper(req.organisationTag, 'onboard/intro', query, req.getLocale()).getUrl(),
    hashtagsAction: new UrlHelper(req.organisationTag, 'onboard/hashtags', query, req.getLocale()).getUrl(),
    linksAction: new UrlHelper(req.organisationTag, 'onboard/links', query, req.getLocale()).getUrl()
  };
  return next();
});

// First we check there is an organisation.
// If there is an org, we now the user belongs there from restrict.js
router.use(function(req, res, next) {
  if (!res.locals.organisation) {
    err = new Error('Subdomain required');
    err.status = 400;
    return next(err);
  }
  return next();
});

//@todo record the datetime of clic on "I am ready" on the welcome page to validate tos
//@todo we could do some asynchronous mining here to save time loading onbaord/intro
router.get('/welcome', function(req, res, next) {
  res.render('onboard/welcome', {
    bodyClass: 'onboard onboard-welcome'
  });
});

// Get the record by query
router.use(function(req, res, next) {
  if (!req.query.recordId) return next();
  Record.findById(req.query.recordId, res.locals.organisation._id, function(err, record) {
    if (err) return next(err);
    if (!record) {
      let err = new Error('Record not found');
      err.status = 404;
      return next(err);
    }
    if (res.locals.user.ownsRecord(record._id) ||
    res.locals.user.isAdminToOrganisation(record.organisation) ||
    res.locals.user.isSuperAdmin()) {
      res.locals.record = record;
      return next();
    } else {
      let err = new Error('Forbidden Record');
      err.status = 403;
      return next(err);
    }
  });
});

// Get the record by user
router.use(function(req, res, next) {
  if (res.locals.record) return next();
  var myRecordId = res.locals.user.getRecordIdByOrgId(res.locals.organisation._id);
  if (!myRecordId) return next();

  Record.findById(myRecordId, res.locals.organisation._id, function(err, record) {
    if (err) return next(err);
    if (!record) {
      // we could throw an error, but it's better to create a new record for the user
      return next();
    }
    res.locals.record = record;
    return next();
  });
});

// Get the record by loginEmail
router.use(function(req, res, next) {
  if (res.locals.record) return next();
  if (!res.locals.user.loginEmail) return next();

  Record.findByEmail(res.locals.user.loginEmail, res.locals.organisation._id, function(err, record) {
    if (err) return next(err);
    if (!record) return next();
    res.locals.record = record;
    res.locals.user.attachOrgAndRecord(res.locals.organisation, record, function(err, user) {
      if (err) return next(err);
      return next();
    });
  });
});

// No Record ? If the user is logged in with Google, we have a chance to find the record by Google Id
var GoogleRecord = require('../models/google/google_record.js');
router.use(function(req, res, next) {
  if (res.locals.record) return next();
  if (!undefsafe(res.locals.user, 'google.id')) return next();

  GoogleRecord.getByGoogleId(res.locals.user.google.id, res.locals.organisation._id, function(err, record) {
    if (err) return next(err);
    if (!record) return next();
    res.locals.record = record;
    res.locals.user.attachOrgAndRecord(res.locals.organisation, record, function(err, user) {
      if (err) return next(err);
      return next();
    });
  });

});

// No Record ? If the user is looged in with Google, we can create one with Google Plus
// @todo do the same to enrich existing record with google plus profile
var googlePlus = require('../models/google/google_plus.js');
router.use(function(req, res, next) {
  if (res.locals.record) return next();
  if (!undefsafe(res.locals.user, 'google.id')) return next();
  if (!req.googleOAuth) return next();

  var plus = new googlePlus(req.googleOAuth);
  plus.makeRecord(res.locals.organisation._id, function(err, record) {
    if(err) return next(err);
    if(record) {
      record.save(function(err, record) {
        if (err) return next(err);
        res.locals.record = record;
        res.locals.user.attachOrgAndRecord(res.locals.organisation, record, function(err, user) {
          if (err) return next(err);
          return next();
        });
      });
    } else return next();
  });
});

// No Record ? Last Chance, we always have a login email to create a record from :)
router.use(function(req, res, next) {
  if (res.locals.record) return next();

  let record = Record.makeFromEmail(res.locals.user.loginEmail, res.locals.organisation._id);
  record.save(function(err, record) {
    if (err) return next(err);
    res.locals.record = record;
    res.locals.user.attachOrgAndRecord(res.locals.organisation, record, function(err, user) {
      if (err) return next(err);
      return next();
    });
  });
});

// Finally if we get here, something went wrong
router.use(function(req, res, next) {
  if (res.locals.record) return next();
  var err = new Error('No record found');
  err.status = 400;
  return next(err);
});

/**
 * @description populate fields in order to make it easy to create a second (or more) profil in another org.
 */
router.use('intro', function(req, res, next){
  if( (!(res.locals.record && req.query.first)) || (req.query.recordId) || res.locals.user.orgsAndRecords.length === 1) return next();

  res.locals.user.findLatestRecord(res.locals.record._id).then(latestRecord=>{
    Record.findById(latestRecord._id, latestRecord.organisation, function(err, sourceRecord){
      if(err) return next();

      // Prefill new record with source one.
      var fieldsToUpdate = {name: sourceRecord.name, picture: sourceRecord.picture, links: sourceRecord.links, hashtags:sourceRecord.hashtags};
      for (var attrname in fieldsToUpdate) { res.locals.record[attrname] = fieldsToUpdate[attrname]; }

      // Inform user that record is prepopulate from older one.
      Organisation.findById(sourceRecord.organisation).then(sourceOrganisation=>{
        res.locals.errors = [{msg: 
          req.__("Hello , to help you create your Profile in {{targetOrg}}, we just copied some info from your Profile in {{sourceOrg}}. Of course you should change those as you wish!", 
                                        {targetOrg: res.locals.organisation.name, sourceOrg:sourceOrganisation.name})}]; 
        return next();
      });
    });
  }).catch(error=>{
    ErrorsMonitoringHelper.printError(error, 261, 'quentin', 'models/user.js');
    return next();
  });
});

// Warning for public organisation
router.use(function(req, res, next){
  if(res.locals.organisation.public){
    res.locals.warning = [{msg: req.__("This is a public Wingzy, your info will be publicly available on internet")}];
  }
  return next();
});

router.use(function(req, res, next) {
  res.locals.onboard.returnUrl = UrlHelper.makeUrl(req.organisationTag, `profile/${res.locals.record.tag}`, null, req.getLocale());
  next();
});

// We try our luck with fullcontact to help user fill her profile.
// That can be done after rendering the page ;)
router.post('/welcome', function(req, res, next) {
  var fullcontact = new FullContact(res.locals.record);
  fullcontact.enrich(function(err, record) {
    if (err && err.status !== 418) return console.error(err);
    if (err && err.status === 418) console.log(err.message);
    else console.log(`FullContact lookup for record ${res.locals.record._id}`);
    next();
  });
});

router.post('/welcome', function(req, res, next) {
  res.redirect(res.locals.onboard.introAction);
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

router.use(function(req, res, next) {
  res.locals.algoliaPublicKey = AlgoliaOrganisation.makePublicKey(res.locals.organisation._id);
  res.locals.uploadcarePublicKey = process.env.UPLOADCARE_PUBLIC_KEY;
  next();
});

/**
 * @description Get all the featuredWings records add by the org admin.
 */
router.all('/intro', function(req, res, next){
  res.locals.organisation.getFeaturedWingsRecords().then(records=>{
    res.locals.featuredWings = records;
    return next();
  }).catch(error=>{return next(error);});
});


/**
 * @description Checked the wings for which the user had chosen.
 */
router.all('/intro', function(req, res, next) {
  res.locals.record.hashtags.forEach(function(hashtag) {
      var wing = res.locals.featuredWings.find(wing => wing._id.equals(hashtag._id));
      if (wing) wing.checked = true;
  });
  next();
});

/**
 * @description Order featuredWings by featuredWingsFamily and create object to display them.
 */
router.all('/intro', function(req, res, next){
  res.locals.featuredWingsByFamily = [];
  res.locals.organisation.populateFirstWings().then(()=>{
    res.locals.organisation.featuredWingsFamily.forEach(featuredWingFamily=>{
      let records  = res.locals.featuredWings.filter(wing => wing.hasWing(featuredWingFamily));
      records.length>0 ? res.locals.featuredWingsByFamily.push(
        {title: featuredWingFamily.intro? featuredWingFamily.intro : req.__("Choose your first wings"), records: records}) : '';
    });
    return next();
  }).catch(error=> {return next(error);});
});

// Load the whole organisation records, we'll need those for further use
// Duplicate in google_admin && fullcontact_admin && record_admin
// @todo this is such a bad idea. But makeWithin and makeIncludes require that at the moment
router.post('/intro', function(req, res, next) {
  if (res.locals.organisation.records) return next();
  res.locals.organisation.populateRecords(true,function(err, organisation) {
    if (err) return next(err);
    else return next();
  });
});

router.post('/intro',
  sanitizeBody('name').trim().escape().stripLow(true),
  sanitizeBody('intro').trim().escape().stripLow(true),
  sanitizeBody('intro').customSanitizer(value => {
    return value.substr(0, 256);
  })
);

router.post('/intro',
  body('name').isLength({ min: 1, max: 64 }).withMessage((value, {req}) => {
    return req.__('Please write a name (no larger than 64 characters).');
  }),
  body('intro').isLength({ max: 256 }).withMessage((value, {req}) => {
    return req.__('Please write an intro no larger than 256 characters.');
  }),
  body('picture.url').optional({checkFalsy:true}).isURL({ protocols: ['https'] }).withMessage((value, {req}) => {
    return req.__('Please provide a profile picture');
  }),
  //@todo should be in sanitizer
  body('wings').custom((value, { req }) => {
    if (!Array.isArray(value)) {
      if (!value) value = [];
      else value = [value];
    }
    req.body.wings = value;
    return true;
})
);

function getRandomInt(max) {
  return Math.round(Math.random() * Math.floor(max));
}

router.post('/intro', function(req, res, next) {
  res.locals.record.name = req.body.name;
  res.locals.record.intro = req.body.intro;
  req.body.wings.forEach((wingTag) => {
    res.locals.featuredWings.find(record => record.tagEquals(wingTag)).checked = true;
  });
  if (!req.body.picture.url) {
    var firstWings = res.locals.featuredWings.filter(record => record.checked && record.picture.url);

    if (firstWings.length > 0) res.locals.record.picture.url = firstWings[getRandomInt(firstWings.length-1)].picture.url;
    else res.locals.record.picture.url = null;
  } else {
    res.locals.record.picture.url = req.body.picture.url;
  }
  var errors = validationResult(req);
  res.locals.errors = errors.array();
  if (errors.isEmpty()) {
    res.locals.record.makeWithin(res.locals.organisation, function(err, records) {
      if (err) return next(err);
      res.locals.record.addHashtags(req.body.wings, res.locals.organisation._id, function(err, records) {
        if (err) return next(err);
        if (res.locals.record.picture.url) {
          res.locals.record.addPictureByUrl(res.locals.record.picture.url, function(err, record) {
            if (err) return next(err);
            res.locals.record.save(function(err, record) {
              if(err) return next(err);
              if (req.query.first) return res.redirect(res.locals.onboard.hashtagsAction);
              else return res.redirect(res.locals.onboard.returnUrl);
            });
          });
        } else {
          res.locals.record.save(function(err, record) {
            if (err) return next(err);
            if (req.query.first) return res.redirect(res.locals.onboard.hashtagsAction);
            else return res.redirect(res.locals.onboard.returnUrl);
          });
        }
      });
    });
  } else {
    next();
  }
});

//@todo escaping will happen in the record model, is it really a good idea not to do it here ?
router.post('/hashtags',
  sanitizeBody('hashtags').trim().stripLow(false)
);

router.post('/hashtags', function(req, res, next) {
  var hashtagsArray = req.body.hashtags.split(',');
  hashtagsArray = hashtagsArray.filter(tag => tag.length > 1);
  res.locals.record.makeHashtags(hashtagsArray, res.locals.organisation._id, function(err, records) {
    if (err) return next(err);
    res.locals.record.save(function(err, record) {
      if (err) return next(err);
      if (req.query.first) return res.redirect(res.locals.onboard.linksAction);
      else return res.redirect(res.locals.onboard.returnUrl);
    });
  });
});

//@todo should be in sanitizer
router.post('/links',
  body('links').custom((links, { req }) => {
    if (!links) {
      links = {values: [], types: []};
    }
    if (!Array.isArray(links.values)) {
      if (!links.values) links.values = [];
      else links.values = [links.values];
    }
    if (!Array.isArray(links.types)) {
      if (!links.types) links.types = [];
      else links.types = [links.types];
    }
    req.body.links = links;
    return true;
  })
);

router.post('/links', function(req, res, next) {
  var links = [];
  req.body.links.values.forEach(function(value, index) {
    links.push(LinkHelper.makeLink(value, req.body.links.types[index]));
  });
  res.locals.record.makeLinks(links);
  res.locals.record.save(function(err, record) {
    if (err) return next(err);
    if (req.query.first) {
      res.locals.user.welcomeToOrganisation(res.locals.organisation._id, function(err, user) {
        if (err) console.error(err);
        if (res.locals.organisation.canInvite || res.locals.user.isAdminToOrganisation(res.locals.organisation)) return res.redirect(UrlHelper.makeUrl(res.locals.organisation.tag, 'invite', null, req.getLocale()));
        else return res.redirect(UrlHelper.makeUrl(res.locals.organisation.tag, null, null, req.getLocale()));
      });
    } else {
      return res.redirect(res.locals.onboard.returnUrl);
    }
  });
});

router.all('/intro', function(req, res, next) {
  res.locals.uploadcareUrl = res.locals.record.getUploadcareUrl() || '';
  next();
});

router.all('/intro', function(req, res, next) {
  res.locals.onboard.step = "intro";
  res.locals.onboard.intro = true;
  res.render('onboard/intro', {
    bodyClass: 'onboard onboard-intro'
  });
});

router.all('/hashtags', function(req, res, next) {
  res.locals.onboard.step = "hashtags";
  res.locals.onboard.hashtags = true;
  res.locals.hashtagsAsString = req.body.hashtags || res.locals.record.hashtags.reduce((string, hashtag) => string + ',' + hashtag.tag, '').substring(1);
  res.render('onboard/hashtags', {
    bodyClass: 'onboard onboard-hashtags'
  });
});

router.all('/links', function(req, res, next) {
  res.locals.onboard.step = "links";
  res.locals.onboard.links = true;
  res.locals.record.links.forEach(link => link.editable = true);
  res.render('onboard/links', {
    bodyClass: 'onboard onboard-links'
  });
});

module.exports = router;
