var express = require('express');
var router = express.Router();

var google = require('googleapis');
var AlgoliaOrganisation = require('../models/algolia/algolia_organisation.js');
var plus = google.plus('v1');
var User = require('../models/user.js');
var Record = require('../models/record.js');

router.get('/google/app', function(req, res, next) {
  plus.people.get({userId: 'me', auth: req.googleOAuth}, function (err, ans) {
    if (err) return next(err);
    return res.render('index', {title: 'You are', content: ans});
  });
});

router.get('/', function(req, res, next) {
  //@todo deduplicate these next 10 lines with private.js / public.js
  res.locals.algoliaPublicKey = AlgoliaOrganisation.makePublicKey(res.locals.organisation._id);
  res.locals.orgTree = res.locals.organisation.tree;
  res.locals.isAdmin = res.locals.user.isAdminToOrganisation(res.locals.organisation._id);
  res.locals.myRecordId = res.locals.user.getRecordIdByOrgId(res.locals.organisation._id);
  res.locals.isDevelopment = req.app.get('env') == 'development';
  res.locals.isMyOrg = true;
  res.locals.isCreator = true;
  res.locals.intro = res.locals.intro || {welcome: true};
  /*if (res.locals.user.needsWelcoming()) {
    res.locals.intro_auto = true;
    res.locals.user.welcome(err => {if (err) console.error(err);});
  }*/
  res.render('directory', {search: true});
});

router.get('/welcome', function(req, res, next) {
  res.locals.algoliaPublicKey = AlgoliaOrganisation.makePublicKey(res.locals.organisation._id);
  res.render('edit_welcome', {layout: 'home/layout_home', bodyClass: 'home'});
});

module.exports = router;
