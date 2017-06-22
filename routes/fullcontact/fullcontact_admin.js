/**
 * @Author: Clément Dietschy <clement>
 * @Date:   21-06-2017 02:19
 * @Email:  clement@lenom.io
 * @Project: Lenom - Backflip
 * @Last modified by:   clement
 * @Last modified time: 21-06-2017 05:36
 * @Copyright: Clément Dietschy 2017
 */

var express = require('express');
var router = express.Router();

var Record = require('../../models/record.js');
var FullContactRecord = require('../../models/fullcontact/fullcontact_record.js');

router.get('/enrich/:recordId', function (req, res, next) {
  Record.findById(req.params.recordId, function(err, record) {
    if (err) return next(err);
    if (!record) {
       err = new Error('No record found');
       err.status = 400;
       return next(err);
    }
    if (!record.organisation.equals(res.locals.organisation._id)) {
       err = new Error('Record not in this organisation');
       err.status = 403;
       return next(err);
    }
    fullContactRecord = new FullContactRecord(record);
    fullContactRecord.enrich(function(err, record){
      if (err) return next(err);
      res.render('index',
      {
        title: 'Enrich Record',
        details: 'The Record has been enriched with FullContact',
        content: record
      });
    });
  });
});

// Load the whole organisation records, we'll need those for further use
// Duplicate in google_admin && fullcontact_admin && record_admin
// @todo this is such a bad idea. But makeWithin and makeIncludes require that at the moment
router.use(function(req, res, next) {
  if (res.locals.organisation.records) return next();
  Record.find({organisation: res.locals.organisation._id})
  .exec(function(err, records) {
    if (err) return next(err);
    res.locals.organisation.records = records;
    return next();
  });
});

router.get('/enrichall', function(req, res, next) {
  var results = [];
  res.locals.organisation.records.forEach(function(record) {
    fullContactRecord = new FullContactRecord(record);
    fullContactRecord.enrich(function(err, savedRecord) {
      if (err) results.push({name: record.name, msg: err.message});
      else results.push({name: record.name, msg: 'Enriched'});
      if (results.length === res.locals.organisation.records.length) {
        enrichedLength = results.filter(result => result.msg === 'Enriched').length;
        res.render('index',
        {
          title: 'Enrich Records',
          details: `${enrichedLength} out of ${results.length} Record has been enriched with FullContact`,
          content: results
        });
      }
    });
  });
});

 module.exports = router;