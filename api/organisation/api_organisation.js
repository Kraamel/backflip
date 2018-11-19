var express = require('express');
var router = express.Router();
var Organisation = require('../../models/organisation');
var auth = require('../middleware_auth');

/**
 * @api {get} /api/organisation/:orgTag Get minors data of an Organisation
 * @apiName GetOrganisationForPublic
 * @apiGroup Organisation
 * @apiVersion 0.9.0
 * 
 * @apiParam {String} orgTag Tag of the Organisation
 * 
 * @apiSuccess {String} message Organisation fetch with success.
 * @apiSuccess {Organisation} organisation Organisation object
 * 
 * @apiError (500 Internal Server Error) InternalError Internal error
 * @apiError (400 Bad Request) BadRequest Missing parameters
 * @apiError (404 Not Found) OrganisationNotFound Organisation not found.
 */
router.get('/:orgTag', function(req, res, next) {
    Organisation.find({'tag' : req.params.tag})
    .then(organisation => {
        if(!organisation) return res.status(404).json({message: 'Organisation not found.'});
        return res.status(200).json({
                                        message: 'Organisation fetch with success.', 
                                        organisation:   {
                                                            tag: organisation.tag, 
                                                            name: organisation.name, 
                                                            logo: organisation.logo.url
                                                        }
                                    });
    }).catch(resWithError);
});

let resWithError = (err) => {
    return res.status(500).json({message: 'Internal error', errors: [err]});
};

module.exports = router;