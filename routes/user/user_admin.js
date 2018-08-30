var express = require('express');
var router = express.Router();
var undefsafe = require('undefsafe');

const { body,validationResult } = require('express-validator/check');
const { sanitizeBody } = require('express-validator/filter');

var User = require('../../models/user.js');
var Record = require('../../models/record.js');
var EmailUser = require('../../models/email/email_user.js');
var EmailHelper = require('../../helpers/email_helper.js');
var UrlHelper = require('../../helpers/url_helper.js');


router.get('/:userId/attach/:recordId', function(req, res, next) {
  User.findOne({_id: req.params.userId, 'orgsAndRecords.organisation': res.locals.organisation._id})
  .populate('orgsAndRecords.record')
  .populate('orgsAndRecords.organisation', 'name picture tag')
  .exec(function(err, user) {
    if (err) return next(err);
    if (!user) return next(new Error('User not found'));
    Record.findOne({_id: req.params.recordId, organisation: res.locals.organisation._id, type: 'person'}, function(err, record) {
      if (err) return next(err);
      if (!record) return next(new Error('Record not found'));
      user.attachOrgAndRecord(res.locals.organisation, record, function(err, user) {
        if (err) return next(err);
        res.render('index',
          {
            title: 'Attached Record to User',
            details: `Attached record ${record.tag} to user ${user.loginEmail} in org ${res.locals.organisation.name}.`,
            content: user
          }
        );
      });
    });
  });
});

router.get('/:userId/unwelcome', function(req, res, next) {
  User.findOne({_id: req.params.userId, 'orgsAndRecords.organisation': res.locals.organisation._id})
  .exec(function(err, user) {
    if (err) return next(err);
    if (!user) return next(new Error('User not found'));
    user.unwelcomeToOrganisation(res.locals.organisation._id, function(err, user) {
      if (err) return next(err);
      res.render('index',
        {
          title: 'User Unwelcomed',
          details: `User ${user.loginEmail} must reonboard to ${res.locals.organisation.name}.`,
          content: user
        }
      );
    });
  });
});

router.get('/:userId/ban', function(req, res, next) {
  User.findOne({_id: req.params.userId, 'orgsAndRecords.organisation': res.locals.organisation._id})
  .exec(function(err, user) {
    if (err) return next(err);
    if (!user) return next(new Error('User not found'));
    user.detachOrg(res.locals.organisation._id, function(err, user) {
      if (err) return next(err);
      res.render('index',
        {
          title: req.__('User banned'),
          details:  req.__('The user {{loginEmail}} has been banned from {{{organisation}}}.<br/>If you want to remove his/her record from this Wingzy, please go to <strong>profile > remove</strong>.', {loginEmail: user.loginEmail, organisation: res.locals.organisation.name}),
          content: res.locals.user.isSuperAdmin() ? user : null
        }
      );
    });
  });
});

router.get('/unwelcomeAll', function(req, res, next) {
  User.find({'orgsAndRecords.organisation': res.locals.organisation._id})
  .exec(function(err, users) {
    if (err) return next(err);
    var saved = 0;
    users.forEach(user => {
      user.unwelcomeToOrganisation(res.locals.organisation._id, function(err, user) {
        if (err) return next(err);
        saved++;
        if (saved === users.length) {
          res.render('index',
            {
              title: 'Users Unwelcomed',
              details: `Unwelcomed ${users.length} users in ${res.locals.organisation.name}.`,
              content: users
            }
          );
        }
      });
    });
  });
});


router.get('/list/:sort?', function(req, res, next) {
  var sort = req.params.sort || '-created';
  User.find({'orgsAndRecords.organisation': res.locals.organisation._id})
  .select('created updated last_login last_action email.value google.id google.email google.hd orgsAndRecords')
  .populate('orgsAndRecords.record')
  .sort(sort)
  .exec(function(err, users) {
    if (err) return next(err);
    res.render('admin/user_list',
      {
        title: req.__('List of users'),
        details: req.__('Woaw, there are {{{count}}} users in {{{organisation}}} !', {count: users.length, organisation: res.locals.organisation.name}),
        users: users,
        bodyClass: 'user-list'
      }
    );
  });
});

router.all('/email/spread', function(req, res, next) {
  res.locals.spreadAction = UrlHelper.makeUrl(req.organisationTag, 'admin/user/email/spread/', null, req.getLocale());
  res.locals.backUrl = UrlHelper.makeUrl(req.organisationTag, 'admin/', null, req.getLocale());
  next();
});

//@todo only works for email users because the email logic is bound to the email auth at the moment
router.get('/email/spread', function(req, res, next) {
  User.find({
    'orgsAndRecords.organisation': res.locals.organisation._id
    })
  .populate('orgsAndRecords.record')
  .exec(function(err, users) {
    if (err) return next(err);
    var records = users
      .map(user => user.getRecord(res.locals.organisation._id))
      .filter(record => record && record != {});
    return res.render('admin/user_email_spread',
      {
        text: req.__(
          "Hello {{firstName}},\n\nYou are already {{recordsCount}} on the Wingzy of {{organisationName}}.\n\nThank you for revealing your Wings! We all need to be recognized for who we are, what we love, what we know at work. You are already helping a lot.\n\nNow, what about inviting more people of {{organisationName}} to spread their Wings? The more on Wingzy, the more relevant and efficient it becomes...",
          {
            firstName: '{{firstName}}',
            organisationName: res.locals.organisation.name,
            recordsCount: records.length,
          }),
        recipients: users.map(user => user.loginEmail)
      }
    );
  });
});

router.post('/email/spread',
  sanitizeBody('text').trim().escape().stripLow(true)
);

router.post('/email/spread',
  body('text').isLength({ max: 1280 }).withMessage((value, {req}) => {
    return req.__('{{field}} Cannot be longer than {{length}} characters', {field: 'Text', length: 1280});
  })
);

router.post('/email/spread', function(req, res, next) {
  User.find({
    'orgsAndRecords.organisation': res.locals.organisation._id
    })
  .populate('orgsAndRecords.record')
  .exec(function(err, users) {
    if (err) return next(err);
    var records = users
      .map(user => user.getRecord(res.locals.organisation._id))
      .filter(record => record && record != {});
    users.forEach(user => EmailHelper.public.emailSpread(
      user.getName(res.locals.organisation._id).split(' ')[0],
      user.loginEmail,
      res.locals.user.getName(res.locals.organisation._id),
      res.locals.user.loginEmail,
      res.locals.organisation.name,
      UrlHelper.makeUrl(res.locals.organisation.tag, 'invite'),
      req.body.text,
      res
    ));
    return res.render('index',
      {
        title: req.__('Sent'),
        details: req.__('The email was sent to {{recipientsCount}} people', users.length),
        content: users.map(user => user.loginEmail)
      }
    );
  });
});


module.exports = router;
