const mailjet = require ('node-mailjet').connect(process.env.MJ_APIKEY_PUBLIC, process.env.MJ_APIKEY_PRIVATE);
const defaultReciepient = 'hear-me@wingzy.com';
const defaultReciepientName = 'Hear me';
const defaultEmitter = 'bonjour@wingzy.com';
const defaultEmitterName = 'Wingzy';
const defaultLink = 'https://wingzy.com';

let SlackHelper = require('./slack_helper');

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
    emailInvite: function(email, senderName, senderEmail, organisationName, customMessage, url, res) {
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
            "intro": customMessage ? customMessage : res.__("Hello!<br>I am on the Wingzy for <strong>%s</strong>, an intuitive app to find each other according to what we love and know.", organisationName),
            "inviterName": (senderName || defaultEmitterName) +' ('+organisationName+')',
            "button": res.__("Spread your wings"),
            "url": url || defaultLink,
            "outro": res.__("This red button can be used to securely access Wingzy for 30 days.")
          }
        });
      request
        .then(()=>{
          SlackHelper.notify('#alerts-invitation', 'New invitation by ' + senderName + ' ('+senderEmail+') to ' + email + '.');
        })
        .catch(err => {
          console.log(err);
        });
    },
    emailReinvite: function(email, senderName, senderEmail, organisationName, url, locale, i18n) {
      i18n.setLocale(locale);
      const request = mailjet
        .post("send")
        .request({
          "FromEmail": senderEmail || defaultEmitter,
          "FromName": senderName || defaultEmitterName,
          "Subject": i18n.__("Join %s on Wingzy", organisationName),
          "MJ-TemplateID": "200696",
          "MJ-TemplateLanguage": true,
          "Recipients": [
            { "Email": email }
          ],
          "Vars": {
            "intro": i18n.__("Hello!<br>I am on the Wingzy for <strong>%s</strong>, an intuitive app to find each other according to what we love and know.", organisationName),
            "inviterName": (senderName || defaultEmitterName) +' ('+organisationName+')',
            "button": i18n.__("Spread your wings"),
            "url": url || defaultLink,
            "outro": i18n.__("This red button can be used to securely access Wingzy for 30 days.")
          }
        });
      request
        .then(()=>{
          SlackHelper.notify('#alerts-invitation', 'New invitation by ' + senderName + ' ('+senderEmail+') to ' + email + '.');
        })
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
            "orgLogoUrl": 'https://wingzy.io/wingzy.png',
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
      },
      emailInvitationAccepted: function(recipientName, recipientEmail, senderName, senderEmail, organisationName, url, res) {
        const request = mailjet
          .post("send")
          .request({
            "FromEmail": senderEmail || defaultEmitter,
            "FromName": defaultEmitterName,
            "Subject": res.__("Discover the Wings of %s !", senderName),
            "MJ-TemplateID": "571332",
            "MJ-TemplateLanguage": true,
            "Recipients": [
              { "Email": recipientEmail }
            ],
            "Vars": {
              "intro": res.__("Hello %s,<br/> You have invited %s to join %s on Wingzy.<br/> %s has accepted your invitation !<br/> Thank you for spreading your Wings.",
                              recipientName, senderName, organisationName, senderName),
              "button": res.__("See his profile"),
              "url": url || defaultLink,
              "orgLogoUrl": 'https://wingzy.io/wingzy.png',
              "outro": res.__("This red button can be used to securely access Wingzy for 30 days.")
            }
          });
        request
          .then()
          .catch(err => {
            console.log(err);
          });
      },
      emailProposeWings: function(recipientName, recipientEmail, senderName, wingsProposed, organisationName, url, res) {
        const request = mailjet
        .post('send')
        .request({
            "FromEmail": defaultEmitter,
            "FromName": defaultEmitterName,
            "Subject": res.__(
                "{{senderName}} thought about you !", 
                {senderName: senderName}
              ),
            "MJ-TemplateID": "571332",
            "MJ-TemplateLanguage": true,
            "Recipients": [
              { "Email": recipientEmail }
            ],
            "Vars": {
              "intro": res.__(
                "Hello {{recipientName}}, <br/><br/> {{senderName}} thought about you !<br/> He has proposed to you {{wingsCounter}} new Wings, click on the red button to discover them.",
                {recipientName: recipientName, senderName: senderName, wingsCounter: wingsProposed.length}
              ),
              "button": res.__("Discover these Wings"),
              "url": url,
              "orgLogoUrl": 'https://wingzy.io/wingzy.png',
              "outro": res.__("This red button can be used to securely access Wingzy for 30 days.")
            }
        });
        request
        .then()
        .catch(err => console.log(err));
      },
      emailThanksForProposedWings: function(recipientName, recipientEmail, senderName, wingsAccepted, organisationName, url, res) {
        const wingsAcceptedString = (Array.isArray(wingsAccepted)) ? 
                                    wingsAccepted.reduce((stack, curr)=>{
                                        return stack? stack+', '+curr : curr;
                                    }) : '';
        const request = mailjet
        .post('send')
        .request({
            "FromEmail": defaultEmitter,
            "FromName": defaultEmitterName,
            "Subject": res.__(
                "Thank you ! {{senderName}} just accepted {{wingsAcceptedCounter}} Wings from you",
                {wingsAcceptedCounter: wingsAccepted.length, senderName: senderName}
              ),
            "MJ-TemplateID": "571332",
            "MJ-TemplateLanguage": true,
            "Recipients": [
              { "Email": recipientEmail }
            ],
            "Vars": {
              "intro": res.__(
                "Hello {{recipientName}}, <br/><br/> Thank you for your Wings proposition ! {{senderName}} has accepted {{wingsAcceptedCounter}} of them : {{wingsList}}<br/><br/> Feel free to return to his profile.",
                {recipientName: recipientName, senderName: senderName, wingsAcceptedCounter:  wingsAccepted.length, wingsList: wingsAcceptedString}
              ),
              "button": res.__("See his profile"),
              "url": url,
              "orgLogoUrl": 'https://wingzy.io/wingzy.png',
              "outro": res.__("This red button can be used to securely access Wingzy for 30 days.")
            }
        });
        request
        .then()
        .catch(err => console.log(err));
      }
  }
};

module.exports = EmailHelper;
