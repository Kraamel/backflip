var express = require('express');
var router = express.Router();
var Organisation = require('../models/organisation.js');
let SearchLog = require('../models/search_log');
let User = require('../models/user');

let currentDate = new Date();
let dateOneMonthAgo  = currentDate.setMonth(currentDate.getMonth()-1);

/**
 * @description Populate top 10 searched Wings of the Wingzy
 */
router.use('/', function(req, res, next){
    if (!Object.entries)
        Object.entries = function( obj ){
            var ownProps = Object.keys( obj ),
                i = ownProps.length,
                resArray = new Array(i); // preallocate the Array

            while (i--)
                resArray[i] = [ownProps[i], obj[ownProps[i]]];
            return resArray;
        };

    const MAX_WINGS_LIST = 10;

    SearchLog.find({'organisation' : res.locals.organisation._id})
    .then((arrayOfSearchLog)=>{
        let occurenceCount = occurence(arrayOfSearchLog);
        // sort the results
        let ordered = Object.entries(occurenceCount).sort((a,b)=>{
            return b[1].length - a[1].length;
        });

        let topWings = [];
        let BreakException = {};
        let numberOfViewsAllTime = arrayOfSearchLog.filter(searchLog => searchLog.tags.length === 0 && !searchLog.query);

        try {
            ordered.forEach((value, index)=>{
                if(ordered[index][0] !== ''){
                    let tagsList = ordered[index][0].replace(',',', ');
                    topWings.push({tag: tagsList, counter: ordered[index][1].length})
                }
                if(index === (MAX_WINGS_LIST)) throw BreakException;
            });
        } catch (e) {
            if (e !== BreakException) throw e;
        }

        res.locals.viewCountLast30Days = getNumberOfViewsLast30Days(arrayOfSearchLog);
        res.locals.topWings = topWings;
        res.locals.searchCountLast30Days = getNumberOfSearchesLast30Days(arrayOfSearchLog);
        res.locals.searchCount = Math.max(arrayOfSearchLog.length - numberOfViewsAllTime.length, 0);
        res.locals.searchTimeSaved = timeConvert(res.locals.searchCount*10, req); // suppose you earn 10 minutes by searchs ...
        return next();
    }).catch(error=>{
        return next(error);
    });
});

/**
 * @description Get number of users
 */
router.use('/', function(req, res, next){
    User.find({'orgsAndRecords.organisation': res.locals.organisation._id})
    .then((users)=>{
        res.locals.usersCount = users.length;
        return next();
    }).catch(error=>{
        return next(error);
    });
});

/**
 * @description Get number of users actifs
 */
router.use('/', function(req, res, next){
    User.find({'orgsAndRecords.organisation': res.locals.organisation._id,
                'last_action' : { $gte: dateOneMonthAgo}})
    .then((users)=>{
        res.locals.usersActifsCount = users.length;
        res.locale.usersActifs = users;
        return  next();
    }).catch(error=>{
        return next(error);
    });
});


router.get('/', function(req, res, next){
    return res.render('statistics', {bodyClass: 'statistics'});
});


let occurence = function (array) {
    var result = {};
    if (array instanceof Array) { // Check if input is array.
        array.forEach(function (v, i) {
            if (!result[v.tags]) { // Initial object property creation.
                result[v.tags] = [i]; // Create an array for that property.
            } else { // Same occurrences found.
                result[v.tags].push(i); // Fill the array.
            }
        });
    }
    return result;
};

let timeConvert = function(time, req) { 
    let days = Math.trunc(time/24/60);
    time -= days*24*60;
    let hours = Math.trunc(time/60);
    time -= hours*60;
    let minutes = time;

    return req.__("{{days}} days {{hours}} hours and {{minutes}} minutes saved thanks to us", 
                {days: days, hours: hours, minutes: minutes});
}

let getNumberOfViewsLast30Days = function(arrayOfSearchLog) {
    let viewCountThisMonth = arrayOfSearchLog.filter(searchLog => searchLog.tags.length === 0 
                                                    && !searchLog.query 
                                                    && searchLog.created.getTime() > dateOneMonthAgo);

    return viewCountThisMonth.length;
}

let getNumberOfSearchesLast30Days = function(arrayOfSearchLog) {
    let searchCountThisMonth = arrayOfSearchLog.filter(searchLog => (searchLog.tags.length > 0 || searchLog.query)
                                                        && searchLog.created.getTime() > dateOneMonthAgo);
    
    return searchCountThisMonth.length;
}

module.exports = router;
