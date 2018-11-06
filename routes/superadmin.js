var express = require('express');
var router = express.Router();
var undefsafe = require('undefsafe');

var google = require('googleapis');
var AlgoliaOrganisation = require('../models/algolia/algolia_organisation.js');

var Organisation = require('../models/organisation.js');
var User = require('../models/user.js');
var Record = require('../models/record.js');
var EmailUser = require('../models/email/email_user.js');
let SearchLog = require('../models/search_log');
var UrlHelper = require('../helpers/url_helper.js');

router.get('/depersonate', function(req, res, next) {
  req.session.user = new User(req.session.impersonator);
  req.session.impersonator = false;
  res.locals.user = req.session.user;
  res.locals.impersonator = null;
  return res.render('index',
    {
      title: 'Depersonate',
      message: 'You are no longer impersonating anybody'
    });
});

router.use( function(req, res, next) {
  if (res.locals.user && res.locals.user.isSuperAdmin()) {
    return next();
  }
  else {
    err = new Error('Forbidden');
    err.status = 403;
    return next(err);
  }
});

router.get('/impersonate/:userEmail', function(req, res, next) {
  User.findOneByEmail(req.params.userEmail, function(err, user) {
    if (err) return next(err);
    if (!user) {
      err = new Error('No user found');
      err.status = 400;
      return next(err);
    }
    user.populate('orgsAndRecords.record', 'name picture tag');
    user.populate('orgsAndRecords.organisation', 'name picture tag');
    req.session.impersonator = new User(req.session.user);
    req.session.user = user;
    res.locals.impersonator = req.session.impersonator;
    res.locals.user = req.session.user;

    return res.redirect(new UrlHelper(user.getFirstOrgTag()).getUrl());
  });
});

router.get('/user/:userEmail/setName/:name', function(req, res, next) {
  User.findOneByEmail(req.params.userEmail, function(err, user) {
    if (err) return next(err);
    if (!user) {
      err = new Error('No user found');
      err.status = 400;
      return next(err);
    }

    user.name = req.params.name;
    user.save(function(err, user) {
      if (err) return next(err);
      res.render('index',
        {
          title: 'Username Set',
          details: `User ${user._id} has now name ${user.name}`,
          content: user
        }
      );
    });
  });
});

router.get('/user/:userEmail/setSenderEmail/:senderEmail', function(req, res, next) {
  User.findOneByEmail(req.params.userEmail, function(err, user) {
    if (err) return next(err);
    if (!user) {
      err = new Error('No user found');
      err.status = 400;
      return next(err);
    }

    user.senderEmail = req.params.senderEmail;
    user.save(function(err, user) {
      if (err) return next(err);
      res.render('index',
        {
          title: 'Sender Email Set',
          details: `User ${user._id} has now sender email ${user.senderEmail}`,
          content: user
        }
      );
    });
  });
});

//@todo filter on query, not after o.O
router.get('/user/list/:filter?/:sort?', function(req, res, next) {
  var sort = req.params.sort || '-created';
  User.find()
  .select('created updated last_login last_action email.value google.email google.value google.hd orgsAndRecords invitations')
  .sort(sort)
  .populate('orgsAndRecords.organisation', 'tag')
  .populate('invitations.organisation', 'tag')
  .exec(function(err, users) {
    if (err) return next(err);
    users = users.filter(user => {
      switch (req.params.filter) {
        case 'login':
          return user.last_login;
        case 'loginOrphans':
          return user.last_login && user.orgsAndRecords.length === 0;
        case 'activeMonth':
          return user.last_action > Date.now() - 30*24*3600*1000;
        case 'activeWeek':
          return user.last_action > Date.now() - 7*24*3600*1000;
        case 'activeDay':
          return user.last_action > Date.now() - 1*24*3600*1000;
        case 'activeDay':
          return user.last_action > Date.now() - 1*24*3600*1000;
        default: case 'all':
          return true;
      }
    });
    res.render('index',
      {
        title: 'Users list',
        details: `${users.length} users`,
        content: users
      }
    );
  });
});

//@todo filter on query, not after o.O
router.get('/user/fixDoubleOrg', function(req, res, next) {
  User.find()
  .exec(function(err, users) {
    if (err) return next(err);
    usersWithManyOrgs = users.filter(user => user.orgsAndRecords.length > 1);
    var userUpdated = 0;
    var newUsers = [];
    usersWithManyOrgs.forEach(user => {
      var newOrgsAndRecords = [];
      user.orgsAndRecords.forEach(orgAndRecord => {
        index = newOrgsAndRecords.findIndex(newOrgAndRecord => orgAndRecord.organisation.equals(newOrgAndRecord.organisation));
        if (index >= 0) {
          if(orgAndRecord.record) {
            newOrgsAndRecords[index] = orgAndRecord;
            userUpdated ++;
          }
        } else newOrgsAndRecords.push(orgAndRecord);
      });
      user.orgsAndRecords = newOrgsAndRecords;
      newUsers.push(user);
    });
    var savedCount = 0;
    newUsers.forEach(user => {
      user.save((err, user) => {
        if (err) return next(err);
        savedCount++;
        if (savedCount === newUsers.length) {
          res.render('index',
            {
              title: 'fixDoubleOrg',
              details: `${userUpdated} fixed  of ${savedCount} saved users updated`,
              content: newUsers
            });
          }
        });
      });
    });
});

router.get('/organisation/list', function(req, res, next) {
  Organisation.find().select('tag created google.hd').sort('-created').exec(function(err, organisations) {
    if (err) return next(err);
    res.render('index',
      {
        title: 'Organisations list',
        details: `${organisations.length} organisations`,
        content: organisations
      });
  });
});

router.get('/organisation/create/:orgTag', function(req, res, next) {
  var organisation = new Organisation({
    name: req.params.orgTag,
    tag: req.params.orgTag.replace(/\W/g,'').toLowerCase(),
    creator: res.locals.user._id
  });
  organisation.save(function(err, organisation) {
    if (err) return next(err);
    res.redirect(UrlHelper.makeUrl(organisation.tag, 'admin/organisation/', null, req.getLocale()));
  });
});

router.get('/organisation/:orgTag/makeadmin/:userEmail', function(req, res, next) {
  User.findOneByEmail(req.params.userEmail, function(err, user) {
    if (err) return next(err);
    if (!user) {
      err = new Error('No user found');
      err.status = 400;
      return next(err);
    }
    Organisation.findOne({tag: req.params.orgTag}, function(err, organisation) {
      if (err) return next(err);
      if (!organisation) {
        err = new Error('No organisation found');
        err.status = 400;
        return next(err);
      }
      user.makeAdminToOrganisation(organisation, function(err, user) {
        if (err) return next(err);
        res.render('index',
          {
            title: 'Admin added',
            details: `${user.loginEmail} is now admin of ${organisation.tag}.`,
            content: user
          });
      });
    });
  });
});

router.get('/organisation/:orgTag/addGoogleHD/:hd', function(req, res, next) {
  Organisation.findOne({tag: req.params.orgTag}, function(err, organisation) {
    if (err) return next(err);
    if (!organisation) {
      err = new Error('No organisation found');
      err.status = 400;
      return next(err);
    }
    organisation.addGoogleHD(req.params.hd, function(err, organisation) {
      if (err) return next(err);
      res.render('index',
        {
          title: 'Added Google HD to Organisation',
          details: `${organisation.tag} can now login using ${req.params.hd}.`,
          content: organisation
        });
    });
  });
});

router.get('/organisation/:orgTag/addEmailDomain/:domain', function(req, res, next) {
  Organisation.findOne({tag: req.params.orgTag}, function(err, organisation) {
    if (err) return next(err);
    if (!organisation) {
      err = new Error('No organisation found');
      err.status = 400;
      return next(err);
    }
    organisation.addEmailDomain(req.params.domain, function(err, organisation) {
      if (err) return next(err);
      res.render('index',
        {
          title: 'Added Email Domain to Organisation',
          details: `${organisation.tag} can now login using ${req.params.domain}.`,
          content: organisation
        });
    });
  });
});

router.get('/bigMove/organisation/:orgTag/user/:userId/record/:recordId', function(req, res, next) {
  Organisation.findOne({tag: req.params.orgTag}, function(err, organisation) {
    if (err) return next(err);
    if (!organisation) return next(new Error('Organisation not found'));
    organisation.populateRecords(true, function(err, organisation) {
      if (err) return next(err);
      User.findById(req.params.userId)
      .populate('orgsAndRecords.record')
      .populate('orgsAndRecords.organisation', 'name picture tag')
      .exec(function(err, user) {
        if (err) return next(err);
        if (!user) return next(new Error('User not found'));
        Record.findOne({_id: req.params.recordId, type: 'person'})
        .populate('within')
        .populate('hashtags')
        .exec(function(err, record) {
          if (err) return next(err);
          if (!record) return next(new Error('Record not found'));
          record.changeOrganisation(organisation, function(err, record) {
            if (err) return next(err);
            user.attachOrgAndRecord(organisation, record, function(err, user) {
              if (err) return next(err);
              res.render('index',
                {
                  title: 'Attached Org and Record to User',
                  details: `Attached org ${organisation.name} and record ${record.tag} to user ${user.loginEmail}.`,
                  content: user
                }
              );
            });
          });
        });
      });
    });
  });
});

router.get('/record/clear_deleted', function(req, res, next) {
  Record.deleteMany({deleted: true}, function(err, result) {
    if (err) return next(err);
    res.render('index',
      {
        title: 'Soft Deleted Records have been cleared',
        details: `${result.length} records have been permanently cleared.`,
        content: result
      }
    );
  });
});

router.get('/record/promote/:id', function(req, res, next) {
  if (!res.locals.organisation) {
    let error = new Error('organisation required');
    error.status = 400;
    return next(error);
  }
  Record.findById(req.params.id, res.locals.organisation._id, function(err, record) {
    if (err) return next(err);
    if (!record) {
      let error = new Error('Record not found');
      error.status = 404;
      return next(error);
    }
    record.promoteToAll(function(err, record) {
      res.render('index',
        {
          title: 'Record made public',
          details: `${record.name} is now available to All`,
          content: record
        });
    });
  });
});
router.get('/record/make/featuredWingsFamily/:id', function(req, res, next){
  if (!res.locals.organisation) {
    let error = new Error('organisation required');
    error.status = 400;
    return next(error);
  }
  res.locals.organisation.addFeaturedWingsFamily(req.params.id).then((record)=>{
    res.render('index',
        {
          title: 'Record made featuredWings family',
          content: record
        });
  }).catch(err=> {return next(err);});
});
router.get('/record/demake/featuredWingsFamily/:id', function(req, res, next){
  if (!res.locals.organisation) {
    let error = new Error('organisation required');
    error.status = 400;
    return next(error);
  }
  res.locals.organisation.removeFeaturedWingsFamily(req.params.id).then((record)=>{
    res.render('index',
        {
          title: 'Record demade featuredWings family',
          content: record
        });
  }).catch(err=> {return next(err);});
});

var normalizeEmail = require('express-validator/node_modules/validator/lib/normalizeEmail.js');

// Should not be used as all email are normalized when saved
// But I'm keeping it a while longer in case of need
router.get('/normalizeEmails', function(req, res, next) {
  User.find({}, function(err, users) {
    if (err) return next(err);
    users.forEach(user => {
      if (undefsafe(user, 'email.value')) {
          EmailUser.makeNormalized(user, true);
          EmailUser.makeHash(user, true);
        }
      if (undefsafe(user, 'google.email')) {
        user.google.normalized = User.normalizeEmail(user.google.email);
      }
    });
    User.create(users, function (err, users) {
      if (err) return next(err);
      res.render('index', {
        title: 'Emails normalization',
        details: `${users.length} users email normalized`,
        content: users
      });
    });
  });
});

router.get('/repareEmails', function(req, res, next){
  User.find({ "email.value" : { $regex: /\s+/g}})
  .then(userList=>{
    userList.forEach(user=>{
      user.email.value = user.email.value.trim();
      user.email.normalized = user.email.normalized.trim();
      console.log('User email will be repared : *'+user.email.value+'* | normalized : *' + user.email.value+'*');
      user.save().then(userSaved=>{
        console.log('User email repared : *'+userSaved.email.value+'* | normalized : *' + userSaved.email.value+'*');
      });
    });
    res.render('index', {
      title: 'Emails reparation',
      details: `${userList.length} users email repared`,
      content: userList
    });
  }).catch(error=>{
    res.render('index', {
      title: 'Emails reparation failed',
      details: 'Error in trying to update users emails...',
      content: error
    });
  })
});

/**
 * @description Find users actives by organisation tag
 * @param {orgTag} String
 */
router.use('/statistics/activeUsers/:orgTag', function(req, res, next){
  if(res.locals.user && res.locals.user.isSuperAdmin() && req.params.orgTag){
      Organisation.findOne({tag: req.params.orgTag})
      .then( organisationSearched => {
          SearchLog.aggregate(
            [
              { $match: {organisation: organisationSearched._id}},
              { $group: {_id: '$user', countInteractions: {$sum: 1}}},
              { $sort:{"countInteractions":-1}}
            ]
          ).then(searchLogsByUser => {
            User.populate(searchLogsByUser, {path: '_id'}).then(searchLogsByUserPopulated => {
              res.render('index',
              {
                  title: 'List of the active Users of the organisation : ' + req.params.orgTag,
                  details: 'This is an array of users sorted by interactions number in the organisation. \r\n The counter is called : countInteractions',
                  content: searchLogsByUserPopulated
              });
            }).catch(error => {return next(error);});
          }).catch(error => {return next(error);});
      }).catch(error => {return next(error);});
  }else{
      let error;
      if(req.params.orgTag){
          error = new Error('Missing parameter : /activeUsers/:orgTag');
          error.status = 400;
      } 
      else {
          error = new Error('You are not allowed to use this feature');
          error.status = 403;
      }
      return next(error);
  }
});

module.exports = router;
