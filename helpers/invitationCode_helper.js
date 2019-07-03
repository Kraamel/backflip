"use strict";
let request = require('request');
/**
 */
class InvitationCodeHelper {

	fetchUsedInvitationCode(accessToken, organisationId, accessorId) {
		return new Promise((resolve, reject) => {
			request.get({
				url: (process.env.NODE_ENV == 'development' ? 'http://' : 'https://') + `${process.env.HOST_AUTH}/api/invitationCodes?organisation=${organisationId}&accessor=${accessorId}`,
				json: true,
				headers: {
					'Authorization': `Bearer ${accessToken}`
				}
			}, (error, requestResponse, body) => {
				if (error || (body && body.status && body.status !== 200) || (requestResponse.statusCode !== 200)) {
					return reject(error);
				}
				if(body && body.data && body.data.length > 0) {
					return resolve(body.data[0]);
				} else {
					return resolve(null);
				}
			});
		});
	}

	createInvitationCode(accessToken, creatorId, organisationId) {
		return new Promise((resolve, reject) => {
			request.post({
				url: (process.env.NODE_ENV == 'development' ? 'http://' : 'https://') + `${process.env.HOST_AUTH}/api/invitationCodes`,
				json: true,
				headers: {
					'Authorization': `Bearer ${accessToken}`
				},
				body: {
					invitationCode: {
						creator: creatorId,
						organisation: organisationId
					}
				}
			}, (error, requestResponse, body) => {

				if (error || (body && body.status && body.status !== 200) || (requestResponse.statusCode !== 200)) {
					return reject(error);
				}
				return resolve(body.data);
			});
		});
	}

}

module.exports = new InvitationCodeHelper();
