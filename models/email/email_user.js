var User = require('../user.js');
var undefsafe = require('undefsafe');
var md5 = require('md5');
var randomstring = require('randomstring');

var Record = require('../record.js');
var Organisation = require('../organisation.js');
var EmailHelper = require('../../helpers/email_helper.js');
var UrlHelper = require('../../helpers/url_helper.js');
var LinkedinUserHelper = require('../../helpers/linkedinUser_helper');
var InvitationCodeHelper = require('../../helpers/invitationCode_helper');
var ClientAuthHelper = require('../../helpers/client_auth_helper');
var EmailUser = {};

const tips = [
  "Wanna learn a new skill? Find a coworker who can help on Wingzy!",
  "You can find the right person you need by searching for several Wings at Once.",
  "At work, we spend 2h a day searching for information, we can save 2h a week just by helping each other.",
  "On average there are 18 Wings per profile on Wingzy, but we know you have much more!",
  "Thanks to the invitation link found in the menu, you can even invite your coworkers through Whatsapp.",
  "You can propose Wings to your coworker when visiting their profiles.",
  "Install Wingzy on your phone, just click 'Add to Home Screen'.",
  "Got an idea, a remark, a critic ? We love it: <a href='mailto:feedback@wingzy.com'>feedback@wingzy.com</a>"
];

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

EmailUser.populateUserToken = function(user) {
  if( (user.email.generated && (user.email.generated > Date.now() - 24*30*3600*1000)) && user.email.token ) {
    user.email.token = user.email.token;
  } else {
    user.email.token = randomstring.generate(128); // we modify token, because token is a way to authenticate
    user.email.generated = Date.now();
  }
  return user;
}

EmailUser.generateToken = function (user, callback) {
  if (!user.email.value) {
    err = new Error('Email authentification not activated for user');
    err.status = 403;
    return callback(err);
  }
  EmailUser.makeHash(user);

  user = EmailUser.populateUserToken(user);

  user.save(callback);
};

EmailUser.getRandomTips = function() {
  return tips[Math.floor(0 + Math.random()*(tips.length))];
}

//@todo fails if user.orgsAndRecords not populated
EmailUser.sendLoginEmail = function (user, organisation, res, callback) {
  EmailUser.generateToken(user, function(err, user) {
    if (err) return callback(err);
    let name = organisation ? user.getName(organisation._id).split(' ')[0] : '';
    EmailHelper.public.emailLogin(user.email.value, name, EmailUser.getLoginUrl(user, organisation, res.getLocale()), res);
    return callback(null, user);
  });
};

EmailUser.sendEmailConfirmation = function(user, res, orgTag){
  user.email.normalized = user.email.normalized || User.normalizeEmail(user.email.value);
  user.email.hash = md5(user.email.normalized);
  EmailUser.makeHash(user);

  user = EmailUser.populateUserToken(user);

  return User.updateOne({'_id': user._id}, {$set: user})
  .then(resp => {
    if(resp.ok === 1){
      return EmailHelper.public.emailConfirmation(
        user.email.value, 
        new UrlHelper(orgTag, "api/emails/confirmation/callback/" + user.email.token + '/' + user.email.hash, null, null).getUrl(),
        orgTag,
        res);
    }else{
      throw new Error("Cannot update the user object.");
    }
  });
}

EmailUser.sendNewIntegrationEmail = function(user, integrationName, accessToken, res) {
  let ctaUrl = (process.env.NODE_ENV === 'production' ? 'https://' : 'http://') + process.env.HOST_FRONTFLIP;
  return LinkedinUserHelper.fetchLinkedinUser(accessToken)
  .then(linkedinUser => {
    return EmailHelper.public.emailSecurityIntegration(user.loginEmail, integrationName, (linkedinUser ? linkedinUser.email : ' '), ctaUrl, res);
  }).catch(e => {
    console.error(e);
    return Promise.reject(e);
  });
  
}

EmailUser.sendPasswordRecoveryEmail = function(user, locale, res){
  user.email.normalized = user.email.normalized || User.normalizeEmail(user.email.value);
  user.email.hash = user.email.hash || md5(user.email.normalized);

  user = EmailUser.populateUserToken(user);
  
  return User.updateOne({'_id': user._id}, {$set: user})
  .then(resp => {
    if(resp.ok === 1){
      return EmailHelper.public.emailPasswordRecovery(
        user.email.value, 
        "https://" + process.env.HOST_FRONTFLIP + '/' + locale + '/password/reset/' + user.email.token + '/' + user.email.hash,
        res);
    }else{
      throw new Error("Cannot update the user object.");
    }
  });
}

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

EmailUser.sendConfirmationInscriptionEmail = function(user, organisation, record, res) {
  let firstName = (record ? record.name.split(' ')[0] : null);
  res.setLocale(user.locale);
  return EmailHelper.public.emailConfirmationInscription(
    user.loginEmail, 
    firstName, 
    organisation,
    (new UrlHelper(organisation.tag, null, null, user.locale)).getUrl(),
    res);
}

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

EmailUser.sendReactiveUserEmail = function(user, organisation, record, i18n) {
  let firstName = (record ? record.name.split(' ')[0] : null);
  if(!user.email || !user.email.value) {
    user.email = {
      value: user.loginEmail,
    };
    this.makeNormalized(user);
  }

  return new Promise((resolve, reject) => {
    EmailUser.generateToken(user, function(err, userUpdated) {
      if(err) return reject(err);
      EmailHelper.public.emailReactivateUser(
        userUpdated.loginEmail,
        organisation,
        firstName,
        (process.env.NODE_ENV === 'development' ? 'http://' : 'https://' ) + process.env.HOST_FRONTFLIP  + '/' + userUpdated.locale + '/' +(organisation ? organisation.tag : ''),
        (new UrlHelper(null, 'api/emails/unsubscribe/' + userUpdated.email.token + '/' + userUpdated.email.hash, null, null)).getUrl(),
        EmailUser.getRandomTips(),
        userUpdated.locale,
        i18n).then(resolve()).catch(reject());
    });
  })
}

EmailUser.sendEmailToInvitationCodeCreator = function(organisation, user, record, res) {
  ClientAuthHelper.fetchClientAccessToken()
    .then(accessToken => {
      InvitationCodeHelper.fetchUsedInvitationCode(accessToken, organisation._id, user._id)
        .then(invitationCode => {
          if(!invitationCode) return;
          User.findOne({_id: invitationCode.creator})
            .populate('orgsAndRecords.record', '_id tag name')
            .then(userInviter => {
              let currentOrgAndRecord = userInviter.orgsAndRecords.find(oar => oar.organisation.equals(organisation._id));
              res.setLocale(userInviter.locale);
              EmailHelper.public.emailInvitationAccepted(
                currentOrgAndRecord.record.name.split(' ')[0],
                userInviter.loginEmail,
                record.name,
                null,
                organisation,
                (process.env.NODE_ENV === 'development' ? 'http://' : 'https://') +
                `${process.env.HOST_FRONTFLIP}/${userInviter.locale}/${organisation.tag}/${record.tag}`,
                res
              );
            }).catch(e => console.log('erreuruserInviter: ' + e));
        }).catch(e => console.log('erreurinvitationcode: ' +e));
    }).catch(e => console.log('erreuraccesstoken: ' +e))
}

EmailUser.sendInvitationCtaEmail = function(user, organisation, record, i18n) {
  let firstName = (record ? record.name.split(' ')[0] : null);
  ClientAuthHelper.fetchClientAccessToken()
  .then(accessToken => {
    InvitationCodeHelper.createInvitationCode(accessToken, user._id, organisation._id)
    .then(invitationCode => {
      EmailHelper.public.emailConfirmationInvitation(
        user.loginEmail,
        organisation,
        firstName,
        user.locale,
        (new UrlHelper(organisation.tag, 'code/'+invitationCode.code, null, user.locale)).getUrl(),
        i18n
      ).then().catch(e => console.log(e));
    });
  });
}

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
