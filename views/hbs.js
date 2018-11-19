var hbs = require('hbs');
var errors = require('./errors.json');
var UrlHelper = require('../helpers/url_helper.js');
var User = require('../models/user.js');
var Organisation = require('../models/organisation.js');

hbs.registerHelper('__', function () {
  return this.__.apply(this, arguments);
});

hbs.registerHelper('locale', function() {
  return this.getLocale();
});

hbs.registerHelper('raw', function(options) {
  return options.fn();
});

hbs.registerHelper('json', function(context) {
    return JSON.stringify(context, null, 4);
});

hbs.registerHelper('textfieldJson', function(context) {
  text = '[\n';
  context.forEach(branch => text += JSON.stringify(branch) + ',\n');
  text = text.replace(/,\n$/, '\n');
  text += ']';
  return text;
});

hbs.registerHelper('coverStyle', function(coverUrl) {
  var html = '';
  if(coverUrl) {
    html += 'class="image-preview-single"';
    if (coverUrl !== true) {
      html += 'style="background-image:url(' +
        coverUrl +
        ')"';
    }
  }
  return html;
});

// @todo find somewhere to put & deduplicate the transformLinks (public/js/index.js + views/hbs.js) logic.
hbs.registerHelper('linkDisplay', function(link) {
  return link.display || link.value;
});

// @todo find somewhere to put & deduplicate the transformLinks (public/js/index.js + views/hbs.js) logic.
hbs.registerHelper('linkIcon', function(link) {
  switch (link.type) {
		case 'email':
			return 'fa-envelope-o';
		case 'address':
			return 'fa-map-marker';
    case 'hyperlink':
      return 'fa-link';
    case 'location':
      return 'fa-map-marker';
		default:
			return 'fa-'+link.type;
	}
});

// @todo find somewhere to put & deduplicate the transformLinks (public/js/index.js + views/hbs.js) logic.
hbs.registerHelper('linkUrl', function(link) {
  if (link.url) return link.url;
  if (link.uri) return link.uri;
	switch (link.type) {
		case 'email':
			return 'mailto:'+link.value;
    case 'phone':
      return 'tel:'+link.value;
		case 'address':
			return 'http://maps.google.com/?q='+encodeURIComponent(link.value);
		default:
			return link.value;
	}
});

hbs.registerHelper('pictureUrl', function(picture, type) {
  if (picture && picture.path) {
		return "/images" + picture.path;
  } else if (picture && picture.url) {
  	return picture.url;
		//@todo remove this last if once the refacto URI > URL is done
	} else if (picture && picture.uri) {
		return picture.uri;
	} else {
		switch (type) {
			case 'hashtag' : return "/images/placeholder_hashtag.png";
			default: case 'person' : return "/images/placeholder_person.png";
		}
	}
});

hbs.registerHelper('profilePicture', function(user, organisation) {
  if(!user || !organisation || !organisation._id) return hbs.handlebars.helpers.picture.apply(this, {type: 'person', picture: {}});
  return hbs.handlebars.helpers.picture.apply(this, [user.getRecord(organisation._id)]);
});

hbs.registerHelper('picture', function(item) {
  if (!item) item = {picture: {}, type: 'person'};
  var url = hbs.handlebars.helpers.pictureUrl.apply(this, [item.picture || {}, item.type || 'person']);
  if (url) return '<img src="'+url+'">';
  else return null;
});

hbs.registerHelper('logo', function(organisation) {
  if (organisation) {
    if (organisation.logo && organisation.logo.url) {
      return  `<img src="${organisation.logo.url}" alt="${organisation.name}">`;
    } else {
      return '<img src="/wingzy.png" alt="${organisation.name}">';
    }
  } else {
    return '<img src="/wingzy.png" alt="Wingzy">';
  }
});

var twemoji = require('twemoji');
hbs.registerHelper('icon', function(item) {
  if (item && item.picture && item.picture.emoji)
    return twemoji.parse(item.picture.emoji, {ext: '.svg', folder: 'svg',});
  if (item && item.picture && item.picture.path)
    return '<img src="/images'+item.picture.path+'">';
  else return '';
  //else return '<img src="/images/placeholder_hashtag.png">';
});

hbs.registerHelper('error', function(status, elem) {
  error = errors.find(error => error.status == status || error.status == 500);
  return this.__(error[elem]);
});

hbs.registerHelper('tagLink', function(tag) {
  return `<a href="/?q=${tag}">${tag}</a>`;
});

hbs.registerHelper('tagUrl', function(tag) {
  tag = tag.replace('#', '%23');
  return '/search/' + tag;
});

hbs.registerHelper('suspendUrl', function(organisation, user, json) {
  if (!organisation || !organisation._id) return null;
  var recordTag = '';
  recordId = '';
  if (user) recordId = user.getRecordIdByOrgId(organisation._id) || '';
  var locale = null;
  if (this.getLocale) locale = this.getLocale();
  return new UrlHelper(organisation.tag, `suspend/id/${recordId}`, null, locale).getUrl();
});

hbs.registerHelper('profileUrl', function(organisation, user, json) {
  if (!organisation || !organisation._id) return null;
  var recordTag = '';
  if (user) recordTag = user.getRecordTagByOrgId(organisation._id) || '';
  var query = null;
  if (json === 'json') query = '?json=true';
  var locale = null;
  if (this.getLocale) locale = this.getLocale();
  return new UrlHelper(organisation.tag, `profile/${recordTag}`, query, locale).getUrl();
});

hbs.registerHelper('myEditUrl', function(organisation) {
  if (!organisation || !organisation.tag) return null;
  var locale = null;
  if (this.getLocale) locale = this.getLocale();
  return new UrlHelper(organisation.tag, 'onboard/intro', null, locale).getUrl();
});

hbs.registerHelper('profileLink', function(user, organisation) {
  if (!organisation || !user || !organisation._id) return null;
  recordId = user.getRecordIdByOrgId(organisation._id);
  if (!recordId) return null;
  var locale = null;
  if (this.getLocale) locale = this.getLocale();
  url = new UrlHelper(organisation.tag, `id/${recordId}`, null, locale).getUrl();
  //What about using the refresh icon instrad of the arrow-up?
  return `<a title="${this.__('Profile')}" class="pure-menu-link profile-link" href="${url}">${this.__('Profile')}</a>`;
});

hbs.registerHelper('adminUrl', function(organisation) {
  return new UrlHelper(organisation.tag, `admin/organisation/`, null, this.getLocale()).getUrl();
});

hbs.registerHelper('adminLink', function(user, organisation) {
  if (!organisation || !user || !organisation._id || !user.isAdminToOrganisation(organisation._id)) return null;
  url = new UrlHelper(organisation.tag, `admin/`, null, this.getLocale()).getUrl();
  return `<a title="${this.__('Administration')}" class="pure-menu-link admin-link" href="${url}">${this.__('Administration')}</a>`;
});

hbs.registerHelper('addLink', function(user, organisation) {
  if (!organisation || !user || !organisation._id || !user.belongsToOrganisation(organisation._id)) return null;
  url = new UrlHelper(organisation.tag, `edit/add/`, null, this.getLocale()).getUrl();
  return `<a id="addLink" title="${this.__('Add new record')}" class="fa fa-plus-circle" href="${url}" aria-hidden="true"></a>`;
});

hbs.registerHelper('url', function(path, organisationTag, query) {
  var locale = null;
  if (this.getLocale) locale = this.getLocale();
  if (typeof organisationTag !== 'string') organisationTag = null;
  if (typeof query !== 'string') query = null;
  return new UrlHelper(organisationTag, path, query, locale).getUrl();
});
hbs.registerHelper('whyWingzyUrl', function(locale){
  locale = locale ||this.getLocale();
  return '/' +  locale + '/' + '#whyWingzy';
});

hbs.registerHelper('dataRightLink', function(type, organisation, user) {
  var locale = null;
  if (this.getLocale) locale = this.getLocale();

  var text = '';
  var manual = false;
  var url = '';
  switch (type) {
    case 'policy':
      if (organisation instanceof Organisation) {
        text = organisation.name;
        url = UrlHelper.makeUrl(organisation.tag, 'protectingYourData', null, locale);
      } else {
        text = 'Charte de Protection des Dodos';
        url = UrlHelper.makeUrl(null, 'protectingYourData', null, locale);
      }
    break;
    case 'accessProfile': case 'accessAccount': text = 'Consulter';break;
    case 'exportProfile': case 'exportAccount': text = 'Exporter';break;
    case 'changeProfile': text = 'Modifier';  break;
    case 'changeAccount': text = 'Modifier'; manual=true;  break;
    case 'suspendProfile':  text = 'Suspendre'; break;
    case 'suspendAccount': text = 'Suspendre'; manual=true; break;
    case 'eraseProfile': case 'eraseAccount': text = 'Effacer'; manual = true; break;
    case 'accessCookies': text = 'Voir'; break;
    case 'toggleMonthly': text = 'Désactiver'; break;
  }

  var recordId = '';
  if (organisation instanceof Organisation && user instanceof User) {
    recordId = user.getRecordIdByOrgId(organisation._id);
      switch (type)   {
        case 'policy':
          if (recordId) url = UrlHelper.makeUrl(organisation.tag, 'protectingYourData', null, locale);
          break;
        case 'accessProfile':
          if (recordId) url = UrlHelper.makeUrl(organisation.tag, 'profile', null, locale);
          break;
        case 'exportProfile':
          if (recordId) url = UrlHelper.makeUrl(organisation.tag, 'profile', '?json=true', locale);
          break;
        case 'changeProfile':
          if (recordId) url = UrlHelper.makeUrl(organisation.tag, 'onboard/intro', null, locale);
          break;
        case 'suspendProfile':
          if (recordId) url = UrlHelper.makeUrl(organisation.tag, `suspend/id/${recordId}`, null, locale);
          break;
        case 'toggleMonthly':
          text = user.getMonthly(organisation) ? 'Désactiver' : 'Activer';
          url = UrlHelper.makeUrl(organisation.tag, 'toggleMonthly', null, locale);
          break;
      }
    }
    if (user instanceof User) {
        switch (type)   {
        case 'eraseProfile': case 'eraseAccount': break;
        case 'accessAccount':
          url = UrlHelper.makeUrl(null, 'account', null, locale);
          break;
        case 'exportAccount':
          url = UrlHelper.makeUrl(null, 'account',  '?json=true', locale);
          break;
        case 'accessCookies':
          url = UrlHelper.makeUrl(null, 'cookies',  null, locale);
          break;
      }
  }
  var cssClass = 'right inactive';
  var href = '';
  var onclick = '';
  if (url) {
    cssClass = 'right scale';
    href = `href="${url}"`;
  } else {
    if (manual) {
      onclick = `onclick="alert('Pour faire cette action, contactez-nous, merci !')"`;
      cssClass = 'right inactive';
    } else {
      onclick = `onclick="alert('Pour faire cette action, vous devez être connecté-e, dans une Organisation, avec un profil.')"`;
      cssClass = 'right scale';
    }
  }
  return `<a class="${cssClass}" ${onclick} ${href}>${text}</a>`;
});

hbs.registerHelper('editUrl', function(recordId, organisationTag, step) {
  if (!['intro','hashtags','links'].includes(step)) step = 'intro';
  page = 'onboard/'+step;
  query = '?recordId='+recordId;
  return new UrlHelper(organisationTag, page, query, this.getLocale()).getUrl();
});

hbs.registerHelper('proposeWingsUrl', function(proposeToId, organisationTag){
  return new UrlHelper(organisationTag, 'onboard/hashtags', '?proposeToId='+proposeToId, this.getLocale()).getUrl();
});

hbs.registerHelper('banUrl', function(userId, organisationTag) {
  var locale = null;
  if (this.getLocale) locale = this.getLocale();
  return UrlHelper.makeUrl(organisationTag, 'admin/user/'+userId+'/ban', null, locale);
});
hbs.registerHelper('resendInvitationsUrl', function(organisationTag){
  var locale = null;
  if (this.getLocale) locale = this.getLocale();
  return UrlHelper.makeUrl(organisationTag, 'admin/user/email/resend', null, locale);
});

hbs.registerHelper('deleteUrl', function(recordId, organisationTag) {
  page = 'admin/record/delete/'+recordId;
  return new UrlHelper(organisationTag, page, null, this.getLocale()).getUrl();
});

hbs.registerHelper('homeUrl', function(organisation, locale) {
  locale = typeof locale === 'string' ? locale : null;
  if (!locale && this.getLocale) locale = this.getLocale();
  if (organisation && organisation.tag) return new UrlHelper(organisation.tag, 'search', null, locale).getUrl();
  else return new UrlHelper(null, null, null, locale).getUrl();
});

hbs.registerHelper('currentPersonAvailability', function(user, organisation){
  let record = user.getOrgAndRecord(organisation._id).record;
  return record.personAvailability;
});
hbs.registerHelper('makePersonAvailable', function(user, organisation){
  let recordId = user.getOrgAndRecord(organisation._id).record._id;
  return new UrlHelper(organisation.tag, 'profile/personAvailability/available/recordId/'+recordId, null, this.getLocale()).getUrl();
});
hbs.registerHelper('makePersonUnavailable', function(user, organisation){
  let recordId = user.getOrgAndRecord(organisation._id).record._id;
  return new UrlHelper(organisation.tag, 'profile/personAvailability/unavailable/recordId/'+recordId,null,  this.getLocale()).getUrl();
});
hbs.registerHelper('makePersonUnspecified', function(user, organisation){
  let recordId = user.getOrgAndRecord(organisation._id).record._id;
  return new UrlHelper(organisation.tag, 'profile/personAvailability/unspecified/recordId/'+recordId,null,  this.getLocale()).getUrl();
});

hbs.registerHelper('nl2br', function(string) {
  if (string)
    return string.replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1' + '<br>' + '$2');
});

const tagRegex = /([@#][^\s@#\,\.\!\?\;\(\)]+)/g;

hbs.registerHelper('cleanShortDesc', function(description) {
  return description.substring(0, 160).replace(tagRegex, `<span style="color:#7F8C8D;">$&</span>`).replace(/(?:\r\n|\r|\n)/g, '<br />') + '...';
});

hbs.registerHelper('ifEqual', function(v1, v2, options) {
  if(v1 === v2) {
    return options.fn(this);
  }
  return options.inverse(this);
});

var HandlebarsIntl = require('handlebars-intl');
HandlebarsIntl.registerWith(hbs);

hbs.registerPartials(__dirname + '/partials');
hbs.registerPartials(__dirname + '/home/partials');
hbs.registerPartials(__dirname + '/legal/partials');

module.exports = hbs;
