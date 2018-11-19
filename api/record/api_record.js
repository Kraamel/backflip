var express = require('express');
var router = express.Router();
var auth = require('../middleware_auth');
let Record = require('../../models/record');
let Organisation = require('../../models/organisation');

/**
 * @api {get} /api/record/:orgTag/:recordTag Get record by tag
 * @apiName GetRecord
 * @apiGroup Record
 * @apiVersion 0.9.0
 * 
 * @apiHeader {String} Authorization User 'Bearer access_token'
 * @apiParam {String} recordTag Tag of the Record (person or hashtag)
 * @apiParam {String} orgTag Tag of the Organisation
 *  
 * @apiSuccess {String} message Record fetch with success.
 * @apiSuccess {Record} record Record object
 * 
 * @apiError (500 Internal Server Error) InternalError Internal error
 * @apiError (404 Not Found) RecordNotFound Record not found. OR Organisation not found.
 * @apiError (401 Unauthorized) InvalidGrant Invalid resource owner credentials.
 * @apiError (403 Unauthorized) Unauthorized Client id or secret invalid. OR You haven't access to this Organisation.
 */
router.get('/:orgTag/:recordTag', auth, function(req, res, next) {
    Organisation.findOne({'tag': req.params.orgTag})
    .then(organisation => {
        if(!organisation) return res.status(404).json({message: 'Organisation not found.'});
        if(!req.user.belongsToOrganisation(organisation._id)) return res.status(403).json({message: 'You haven\'t access to this Organisation.'})

        Record.findOne({'tag' : req.params.recordTag, 'organisation': organisation._id})
        .then(record => {
            if(!record) return res.status(404).json({message: 'Record not found.'});
            return res.status(200).json({message: 'Record fetch with success.', record: record});
        }).catch(resWithError);

    }).catch(resWithError);
});

let resWithError = (err) => {
    return res.status(500).json({message: 'Internal error', errors: [err]});
};

module.exports = router;