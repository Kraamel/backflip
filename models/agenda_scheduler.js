var AgendaPack = require('agenda');
var EmailUser = require('../models/email/email_user');
var User =require('../models/user');
var Slack =require('../helpers/slack_helper');

var Agenda = (function () {
    this.agenda = new AgendaPack({db: {address: process.env.MONGODB_URI, collection: 'jobs'}});
    this.i18n;

    this.agenda.on('ready', function() {
        console.log('AGENDA:Ready');
        this.agenda.start();

        this.agenda.define('sendInvitationEmail', (job, done) => {
            let data = job.attrs.data;
            User.findOne({'_id' : data.user._id})
            .then((userUpdated) => {
                if(userUpdated && !userUpdated.last_login) {
                    console.log('AGENDA:Resending an invitation');
                    Slack.notify('#alerts-scheduler', 'AGENDA: Resend invitation email : '+(userUpdated.email.value || null)+' : '+ new Date().toLocaleString('fr-FR'));
                    EmailUser.resendInviteEmail(userUpdated, new User(data.sender), data.organisation, data.locale, this.i18n);
                    this.removeJob(job).then(() => {done();});
                }else{
                    this.removeJob(job).then(() => {done();});
                }
            });
        });

        /**
         * @description Schedule resend invitation after 3 days
         */
        this.scheduleResendInvitation = function(user, sender, organisation, locale) {
            if(process.env.NODE_ENV === 'production'){
                try {
                    let job = this.agenda.create('sendInvitationEmail', 
                                {sender: sender, user: user, organisation:organisation, locale:locale});
                    job.schedule('in 3 days');
                    job.save();
                    let scheduledDate = new Date();
                    scheduledDate = scheduledDate.setDate(scheduledDate.getDate() + 3);
                    let scheduledDateString = new Date(scheduledDate).toLocaleString('fr-FR');
                    Slack.notify('#alerts-scheduler', 'AGENDA: Schedule resend invitation email : '+((new User(user)).email.value || null)+' : '+scheduledDateString);
                } catch (error) {
                    Slack.notifyError(error, 36, 'quentin', 'agenda_scheduler');
                }
            }
        };

        /**
         * @description Remove job from database
         */
        this.removeJob = async function(job) {
            return await job.remove(err => {
                if (!err) {
                    console.log('Successfully removed job from collection');
                    return;
                }
            });
        };
        
    }.bind(this));
    return this;
})();

module.exports = Agenda;