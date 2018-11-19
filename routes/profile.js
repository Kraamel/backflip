var express = require('express');
var router = express.Router();
var undefsafe = require('undefsafe');
var Record = require('../models/record.js');
var UrlHelper = require('../helpers/url_helper.js');

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

/**
 * @description Update the status of a record.
 */
router.get('/personAvailability/:status/recordId/:recordId', function(req, res, next){
  if(req.organisationTag && res.locals.user && req.params.status && req.params.recordId){
    Record.findById(req.params.recordId, res.locals.organisation._id, function(err, record) {
      if (err) return res.redirect(UrlHelper.makeUrl(req.organisationTag,'search/',  null, req.getLocale()));
      if (!record) {
        var error = new Error('Profile not found');
        error.status = 404;
        return next(error);
      }
      record.personAvailability = req.params.status;
      record.save().then((data)=>{
      }).catch(error=>{
      });
      return res.redirect(UrlHelper.makeUrl(req.organisationTag,'search/',  null, req.getLocale()));
    });
  }else{
    return res.redirect(UrlHelper.makeUrl(req.organisationTag,'search/',  null, req.getLocale()));
  }
});

// Get the record
router.get('/:tag?', function(req, res, next) {
  if (!req.params.tag && res.locals.user) {
    var tag = res.locals.user.getRecordTagByOrgId(res.locals.organisation._id);
    var query = req.query.json ? '?json=true' : null;
    if (tag) return res.redirect(UrlHelper.makeUrl(req.organisationTag, 'profile/'+tag, query, req.getLocale()));
  }
  return next();
});

// Get the record
router.get('/:tag', function(req, res, next) {
  Record.findByTag(req.params.tag, res.locals.organisation._id, function(err, record) {
    if (err) return next(err);
    if (!record) {
      var error = new Error('Profile not found');
      error.status = 404;
      return next(error);
    }
    res.locals.record = record;
    next();
  });
});

router.get('/id/:id', function(req, res, next) {
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

router.use(function(req, res, next) {
  if (!res.locals.record) {
    let error = new Error('Profile not found');
    error.status = 404;
    return next(error);
  }
  return next();
});

router.get('*', function(req, res, next) {
  if (!res.locals.user) return next();
  if (res.locals.user.ownsRecord(res.locals.record._id) ||
    res.locals.user.isAdminToOrganisation(res.locals.record.organisation) ||
    res.locals.user.isSuperAdmin()
  ) {
    res.locals.canEdit = true;
  }
  next();
});

router.get('*', function(req, res, next){
  if (res.locals.user && (!res.locals.user.ownsRecord(res.locals.record._id))){
    res.locals.canProposeWings = true;
  }
  next();
});

router.get('*', function(req, res, next) {
  if (!res.locals.user) return next();
  if (res.locals.user.isAdminToOrganisation(res.locals.record.organisation) ||
    res.locals.user.isSuperAdmin()) {
    res.locals.canDelete = true;
  }
  next();
});

router.get('*', function(req, res, next) {
  res.locals.coverUrl = undefsafe(res.locals.record, 'cover.url') || undefsafe(res.locals.organisation, 'cover.url') || true;
  if (res.locals.canEdit) {
    res.locals.editCoverUrl =  UrlHelper.makeUrl(req.organisationTag, 'cover/id/'+res.locals.record._id, null, req.getLocale());
    res.locals.editAboutUrl =  UrlHelper.makeUrl(req.organisationTag, 'about/id/'+res.locals.record._id, null, req.getLocale());
    if (res.locals.record.type === 'hashtag') {
      res.locals.editEmojiUrl =  UrlHelper.makeUrl(req.organisationTag, 'emoji/id/'+res.locals.record._id, null, req.getLocale());
    }
  }
  next();
});

router.get('*', function(req, res, next) {
  if (res.locals.user.isSuperAdmin && res.locals.record.type === 'hashtag') {
    res.locals.editPicturePathUrl =  UrlHelper.makeUrl(req.organisationTag, 'picturePath/id/'+res.locals.record._id, null, req.getLocale());
    if (!res.locals.record.isInTheAllOrganisation())
    res.locals.promoteUrl =  UrlHelper.makeUrl(req.organisationTag, 'superadmin/record/promote/'+res.locals.record._id, null, req.getLocale());
  }
  next();
});

router.get('*', function(req, res, next){
  if(res.locals.record.type=== 'hashtag' && res.locals.user.isSuperAdmin){
    let isIn =  res.locals.organisation.isInFeaturedWingsFamilyArray(res.locals.record._id);
    res.locals.makeFeaturedWingsFamilyUrl= isIn ?null: UrlHelper.makeUrl(req.organisationTag, 'superadmin/record/make/featuredWingsFamily/'+res.locals.record._id, null, req.getLocale());
    res.locals.demakeFeaturedWingsFamilyUrl= isIn? UrlHelper.makeUrl(req.organisationTag, 'superadmin/record/demake/featuredWingsFamily/'+res.locals.record._id, null, req.getLocale()):null;
  }
  next();
});

router.get('*', function(req, res, next) {
  if (req.query.json) {
    return res.json(res.locals.record);
  } else {
    res.render('profile', {
      title: res.locals.record.name,
      bodyClass: 'profile'
    });
  }
});

module.exports = router;
