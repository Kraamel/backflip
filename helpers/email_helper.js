const mailjet = require ('node-mailjet').connect(process.env.MJ_APIKEY_PUBLIC, process.env.MJ_APIKEY_PRIVATE);
const defaultReciepient = 'hear-me@wingzy.io';
const defaultReciepientName = 'Hear me';
const defaultEmitter = 'bonjour@wingzy.io';
const defaultEmitterName = 'Wingzy';
const defaultLink = 'https://wingzy.io';

/**
 *
 * This call sends a message to the given recipient with vars and custom vars.
 *
 */

var EmailHelper = {
  superadmin: {
    newOrg: function(name, email, organisation, link) {
      const request = mailjet
        .post("send", {'version': 'v3.1'})
        .request({
      		"Messages":[
      			{
      				"From": {
      					"Email": defaultEmitter,
      					"Name": defaultEmitterName
      				},
      				"To": [
      					{
      						"Email": defaultReciepient,
      						"Name": defaultReciepientName
      					}
      				],
      				"TemplateID": 164321,
      				"TemplateLanguage": true,
      				"Subject": "New organisation",
      				"Variables": {
                "email": email || "No email",
                "name": name || "No name",
                "organisation": organisation || "No organisation",
                "link": link || defaultLink
              }
      			}
      		]
      	});

        request
        	.then((result) => {
        	})
        	.catch((err) => {
        		console.log(err);
        	});
    }
  },
  public: {
    emailLogin: function(email, name, url, res) {
      const request = mailjet
        .post("send")
        .request({
          "FromEmail": defaultEmitter,
          "FromName": defaultEmitterName,
          "Subject": res.__("Sign in to Wingzy"),
          "MJ-TemplateID": "197497",
          "MJ-TemplateLanguage": true,
          "Recipients": [
            { "Email": email }
          ],
          "Vars": {
            "intro": res.__("Hello %s! We are happy to welcome you back on Wingzy.", name),
            "url": url || defaultLink,
            "button": res.__("Connect and share"),
            "outro": res.__("This red button can be used to securely access Wingzy for 30 days.")
          }
        });
      request
        .then()
        .catch(err => {
          console.log(err);
        });
    },
    emailInvite: function(email, senderName, senderEmail, organisationName, url, res) {
      const request = mailjet
        .post("send")
        .request({
          "FromEmail": senderEmail || defaultEmitter,
          "FromName": senderName || defaultEmitterName,
          "Subject": res.__("Join %s on Wingzy", organisationName),
          "MJ-TemplateID": "200696",
          "MJ-TemplateLanguage": true,
          "Recipients": [
            { "Email": email }
          ],
          "Vars": {
            "intro": res.__("Hello!<br>I am on the Wingzy for <strong>%s</strong>, an intuitive app to find each other according to what we love and know.", organisationName),
            "inviterName": senderName || defaultEmitterName,
            "button": res.__("Spread your wings"),
            "url": url || defaultLink,
            "outro": res.__("This red button can be used to securely access Wingzy for 30 days.")
          }
        });
      request
        .then()
        .catch(err => {
          console.log(err);
        });
    },
    emailSpread: function(recipientName, recipientEmail, senderName, senderEmail, organisationName, url, text, res) {
      const request = mailjet
        .post("send")
        .request({
          "FromEmail": senderEmail || defaultEmitter,
          "FromName": senderName || defaultEmitterName,
          "Subject": res.__("Spread your Wingzy", organisationName),
          "MJ-TemplateID": "519044",
          "MJ-TemplateLanguage": true,
          "Recipients": [
            { "Email": recipientEmail }
          ],
          "Vars": {
            "text": text,
            "button": res.__("Spread your Wingzy"),
            "url": url || defaultLink,
            "outro": res.__("This red button can be used to securely access Wingzy for 30 days.")
          }
        });
      request
        .then()
        .catch(err => {
          console.log(err);
        });
    },
    emailMonthly: function(email, name, inviterName, organisationName, userCount, url, extract, res) {
      const request = mailjet
        .post("send")
        .request({
          "FromEmail": defaultEmitter,
          "FromName": inviterName || defaultEmitterName,
          "Subject": res.__("%s this month", organisationName),
          "MJ-TemplateID": "241873",
          "MJ-TemplateLanguage": true,
          "Recipients": [
            { "Email": email }
          ],
          "Vars": {
            "intro": res.__("Hello %s, we are now %s people from %s on Wingzy. Come have a look at who we are and share a bit more about yourself!", name, userCount, organisationName),
            "inviterName": inviterName || defaultEmitterName,
            "extract": extract || '',
            "button": res.__("Connect and share"),
            "url": url || defaultLink,
            "outro": res.__("This red button can be used to securely access Wingzy for 30 days.")
          }
        });
      request
        .then()
        .catch(err => {
          console.log(err);
        });
      }
  }
};

module.exports = EmailHelper;
