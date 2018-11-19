var User = require('../user.js');
var undefsafe = require('undefsafe');
var md5 = require('md5');
var randomstring = require('randomstring');

var Record = require('../record.js');
var Organisation = require('../organisation.js');
var EmailHelper = require('../../helpers/email_helper.js');
var UrlHelper = require('../../helpers/url_helper.js');
var EmailUser = {};

//@todo look for user with a google email too
EmailUser.getByEmail = function (email, callback) {
  User.findOne({'email.normalized': User.normalizeEmail(email)}).
  populate('orgsAndRecords.record').
  exec(callback);
};

EmailUser.makeNormalized = function(user, force) {
  if (force) user.email.normalized = null;
  user.email.normalized = user.email.normalized || User.normalizeEmail(user.email.value);
};

// @todo move to main model, we got a nasty bug because population was not the same
EmailUser.getByHash = function (hash, callback) {
  User.findOne({'email.hash': hash})
  .populate('orgsAndRecords.record', 'name picture tag')
  .populate('orgsAndRecords.organisation', 'name picture tag')
  .exec(callback);
};

EmailUser.makeHash = function (user, force) {
  if (force) user.email.hash = null;
  if (!user.email.normalized) EmailUser.makeNormalized(user);
  user.email.hash = user.email.hash || md5(user.email.normalized);
};

EmailUser.newFromEmail = function (email) {
  user = new User();
  return EmailUser.addStrategy(email, user);
};

EmailUser.addStrategy = function(email, user, callback) {
  user.email.value = email;
  EmailUser.makeNormalized(user);
  EmailUser.makeHash(user);
  if (callback) return user.save(callback);
  else return user;
};

EmailUser.generateToken = function (user, callback) {
  if (!user.email.value) {
    err = new Error('Email authentification not activated for user');
    err.status = 403;
    return callback(err);
  }
  EmailUser.makeHash(user);
  user.email.token = randomstring.generate(128);
  user.email.generated = Date.now();
  user.save(callback);
};

//@todo fails if user.orgsAndRecords not populated
EmailUser.sendLoginEmail = function (user, organisation, res, callback) {
  EmailUser.generateToken(user, function(err, user) {
    if (err) return callback(err);
    let name = organisation ? user.getName(organisation._id).split(' ')[0] : '';
    EmailHelper.public.emailLogin(user.email.value, name, EmailUser.getLoginUrl(user, organisation, res.getLocale()), res);
    return callback(null, user);
  });
};

//if we generated a token less than 60 sec ago
EmailUser.tooSoon = function (user, callback) {
  return user.email.generated > Date.now() - 60*1000;
};

//@todo fails if user.orgsAndRecords not populated
EmailUser.sendInviteEmail = function (user, sender, organisation, customMessage = null, res, callback) {
  user.addInvitation(organisation, sender);
  EmailUser.generateToken(user, function(err, user) {
      if (err) return callback(err);
      EmailHelper.public.emailInvite(
        user.email.value,
        sender.getName(organisation._id),
        sender.senderEmail,
        organisation.name,
        customMessage,
        EmailUser.getLoginUrl(user, organisation, res.getLocale()),
        res);

      var Agenda = require('../../models/agenda_scheduler');
      Agenda.scheduleResendInvitation(user, sender, organisation, res.getLocale());
      return callback(null, user);
  });
};

EmailUser.resendInviteEmail = function(user, sender, organisation, locale, i18n) {
  user.addInvitation(organisation, sender);
  EmailUser.generateToken(user, function(err, user) {
    if (err) return console.error(err);
    EmailHelper.public.emailReinvite(
      user.email.value,
      sender.getName(organisation._id),
      sender.senderEmail,
      organisation.name,
      EmailUser.getLoginUrl(user, organisation, locale),
      locale,
      i18n);    
});
};

//@todo this should not be here as the logic is shared with other login strategies.
//@todo rewrite to allow all login strategies
EmailUser.sendMonthlyEmail = function(user, sender, organisation, userCount, extract, res, callback) {
  EmailUser.generateToken(user, function(err, user) {
    if (err) return callback(err);
    EmailHelper.public.emailMonthly(
      user.loginEmail,
      user.getName(organisation._id).split(' ')[0],
      sender.getName(organisation._id),
      organisation.name,
      userCount,
      EmailUser.getLoginUrl(user, organisation, res.getLocale()),
      extract,
      res
      );
    return callback(null, user);
  });
};

EmailUser.makeEmailFromGoogle = function(userP, callback) {
  userP.email = {value: userP.google.email};
  EmailUser.generateToken(userP, function(err, user) {
    if (err) return callback(err);
    return callback(null, user);
  });
}

EmailUser.getLoginUrl = function(user, organisation, locale) {
  var url = new UrlHelper(undefsafe(organisation, 'tag'), "email/login/callback", `?hash=${user.email.hash}&token=${user.email.token}`, locale).getUrl();
  return url;
};

EmailUser.login = function(hash, token, callback) {
  EmailUser.getByHash(hash, function(err, user) {
    if (err) return callback(err);
    if (!user) {
      err = new Error('Cannot find user from Hash');
      err.status = 404;
      return callback(err);
    }
    authenticate = EmailUser.authenticate(user, token);
    if (authenticate === true) {
      return callback(null, user);
    } else {
      return callback(authenticate);
    }
  });
};

EmailUser.authenticate = function(user, token) {
  if (EmailUser.tokenStillValid(user.email.generated)) {
    if (user.email.token === token) {
      return true;
    } else {
      err = new Error('Wrong Token');
      err.status = 403;
      return err;
    }
  } else {
    //@todo renew token & send email here instead of failing miserably.
    err = new Error('Token expired');
    err.status = 403;
    return err;
  }
};

EmailUser.tokenStillValid = function(generated) {
  return generated > Date.now() - 24*30*3600*1000;
};

//@todo this is as dodgy as an aligator wearing a kilt asking for the spare change
//@todo can be removed once edit.js is removed
EmailUser.addByEmail = function(email, organisation, record, callback) {
  this.getByEmail(email, function(err, user) {
    if (err) return callback(err);
    if (!user) {
      user = EmailUser.newFromEmail(email);
    }
    /*if (!record) {
      record = Record.makeFromEmail(email, organisation._id);
      record.save(function(err) {if (err) console.error(err);});
    }*/
    user.attachOrgAndRecord(organisation, record, callback);
  });
};

module.exports = EmailUser;
