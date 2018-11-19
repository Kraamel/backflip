var express = require('express');
var router = express.Router();
var Organisation = require('../../models/organisation');
var User = require('../../models/user');
var auth = require('../middleware_auth');

/**
 * @api {get} /api/user/organisations Get Organisations of an User
 * @apiName GetUserOrganisations
 * @apiGroup User
 * @apiVersion 0.9.0
 * 
 * @apiHeader {String} Authorization User 'Bearer access_token'
 * 
 * @apiSuccess {String} message Organisations fetch with success.
 * @apiSuccess {[Organisation]} organisations Organisation object array
 * 
 * @apiError (500 Internal Server Error) InternalError Internal error
 * @apiError (400 Bad Request) BadRequest Missing parameters
 * @apiError (401 Unauthorized) InvalidGrant Invalid resource owner credentials.
 * @apiError (403 Unauthorized) Unauthorized Client id or secret invalid.
 */
router.get('/organisations', auth, function(req, res, next) {
    User.findOne({'_id' : req.user._id})
    .populate('orgsAndRecords.organisation')
    .then(userPopulated => {
        let arrayOfOrg = userPopulated.orgsAndRecords.reduce( (curr, entry) => {
            curr.push(entry.organisation);
        });
        return res.status(200).json({message: 'Success in fetching the Organisations of the User', organisations: arrayOfOrg});
    }).catch(resWithError);
});

let resWithError = (err) => {
    return res.status(500).json({message: 'Internal error', errors: [err]});
};

module.exports = router;