var express = require('express');
var router = express.Router();

var api_organisation = require('./organisation/api_organisation');
router.use('/organisation', api_organisation);

var api_record = require('./record/api_record');
router.use('/record', api_record);

var api_user = require('./user/api_user');
router.use('/user', api_user);

module.exports = router;