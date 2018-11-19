var express = require('express');
var router = express.Router();
var UrlHelper = require('../helpers/url_helper.js');
var Organisation = require('../models/organisation.js');



//Catch the error thrown when setup organisation : the subdomain is wrong
//(we still wen't through auth but need to display the error now)
router.use(function(req, res, next) {
  if (req.organisationError) return next(req.organisationError);
  return next();
});


// Check if user needs Welcoming
//@todo avoid this double redirect on login.
router.get('/search', function(req, res, next) {
  if (res.locals.user && res.locals.organisation && res.locals.user.needsWelcomingToOrganisation(res.locals.organisation._id)) {
    return res.redirect(new UrlHelper(res.locals.organisation.tag, 'onboard/welcome', '?first=true', req.session.locale || req.getLocale()).getUrl());
  }
  return next();
});

// if redirectTo exists, redirect to the page
router.get('*/login/callback', function(req, res, next){
  req.redirectionTag = req.redirectionTag || req.organisationTag;
  if(!req.query.redirectTo) return next();
  let redirectTo = req.query.redirectTo;

  // clean query
  delete req.query.token;
  delete req.query.hash;
  delete req.query.redirectTo;
  delete req.query.subdomains

  // format query for url
  let query = '?';
  for (var queryName in req.query) {
    if( query === '?')
      query += queryName + '=' + req.query[queryName];
    else
      query += '&' + queryName + '=' + req.query[queryName];
  }
  
  return res.redirect(UrlHelper.makeUrl(req.redirectionTag, redirectTo, query, req.session.locale || req.getLocale()));
});

// Find the best organisationTag to redirect to.
router.get('*/login/callback', function(req, res, next) {
  req.redirectionTag = req.redirectionTag || req.organisationTag;

  if (req.session.user.belongsToOrganisationByTag(req.redirectionTag)) {
    return res.redirect(UrlHelper.makeUrl(req.redirectionTag, 'search', null, req.session.locale || req.getLocale()));
  }

  if (req.session.user.getFirstOrgTag()) {
    return res.redirect(UrlHelper.makeUrl(req.session.user.getFirstOrgTag(), 'search', null, req.session.locale || req.getLocale()));
  }

  return res.redirect(UrlHelper.makeUrl(null, 'new/presentation', null, req.session.locale || req.getLocale()));
});

module.exports = router;
