const express = require('express');
const router = express.Router();
const path = require('path');
const _ = require('lodash');
const uuidv1 = require('uuid/v1'); // required to generate user Ids
require('dotenv').config(); // needs keys from .env

const apiKey = process.env.TOKBOX_API_KEY;
const secret = process.env.TOKBOX_SECRET;

if (!apiKey || !secret) {
  console.error('=========================================================================================================');
  console.error('Missing TOKBOX_API_KEY or TOKBOX_SECRET');
  console.error('Find the appropriate values for these by logging into your TokBox Dashboard at: https://tokbox.com/account/#/');
  console.error('Then add them to ', path.resolve('.env'), 'or as environment variables');
  console.error('=========================================================================================================');
  process.exit();
}
// Create the Opentok object
const OpenTok = require('opentok');
const opentok = new OpenTok(apiKey, secret);

// user arrays should take the form of a an array of objects:
// each containing a userId, a grouping,
let userArray = [];
// two arrays as queues for the two groupings
let investorQueue = [];
let ideaQueue = [];
// used to verify that investors haven't already met
let previousMatches = [];
// keeps track of existing sessions that only contain a single user
let userSessionDict = {};
// makes sure that the users haven't already been matched
// takes in an investorId and a IdeaId, and the match array and returns true if they haven't met
function verifyUserMatch(Id1, Id2) {
  return previousMatches.every(match => {
    return !((match[0] === Id1 && match[1] === Id2) || (match[0] === Id2 && match[1] === Id1));
  });
}
// findMatch takes in an Id, an opposite queue and the and also previousMatches
// it then interates through the queue and sees if these's a valId match (needs to start from the
// beginning to be FIFO) it will then return the match, another function should create the session
// and remove the waiting Ids and add them to the made array
// if no macthes found returns false
function findMatch(userId, queue) {
  for (let i = 0; i < queue.length; i += 1) { // maybe a better es6 method but want to short circut
    if (verifyUserMatch(userId, queue[i], previousMatches)) {
      return queue[i];
    }
  }
  return false;
}

// start new session, add it to the dict, and return an object conating all the necessary cred
function getNewSessionCrendtials(userId, res) {
  console.log("GOT TO NEW SESSIONS")
  // create the session
  let sessionId;
  let token;
  opentok.createSession({ mediaMode: 'routed' }, (error, session) => {
    if (error) {
      console.log('Error creating session:', error);
    } else {
      sessionId = session.sessionId;
      // generate a publisher toekn
      token = opentok.generateToken(sessionId);
    }
    // add the session to the dict with the userId as the Key
    userSessionDict[userId] = sessionId;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    console.log('getNewSessionCredentials res.getHeaders()', res.getHeaders());
    res.send({
      apiKey: apiKey,
      sessionId: sessionId,
      token: token
    });
  });
}
// makeMatchCredentials should take in an id, the id of the matched user
// needs to return the credentials and also modiy the dict and also add to the matched array
function makeMatchCredentials(id, matchedId, res) {
  let sessionId = userSessionDict[matchedId];
  let token = opentok.generateToken(sessionId);
  // now that the match is made we remove it from the dict
  delete userSessionDict[matchedId];
  delete ideaQueue[matchedId];
  delete investorQueue[matchedId];
  // add the match to the previous matches
  previousMatches.push([id, matchedId]);

  // then send the resoponse
  res.set({
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  // MAKE MATCH ---------------------------------------- THIS MATTERS
  // -----------------------------------------------------------------
  // -----------------------------------------------------------------
  res.send({
    apiKey: apiKey,
    sessionId: sessionId,
    token: token
  });
}


/**
 * //?? should this be more of a GET or POST request??
 * GET /newUser returns a new userId with a respective role
 */

router.get('/newUser', (req, res) => {
  let userId = uuidv1();
  // if depending on how many people are in the group assign either idea or investor
  let userRole = userArray.length % 2 === 0 ? 'investor' : 'idea';
  let userObject = { userId: userId, userRole: userRole };
  userArray.push(userObject);
  res.setHeader('Content-Type', 'application/json');
  res.send(userObject);
});
// attach the userId to the appropriate queue and then see if the there's a matching session
// if not, create one, then send the client the credentials and pop the users from queues
// first we need to verify that the users haven't already met

router.post('/queue', (req, res) => {
  // console.log('FULL VALUE OF THE REQ TO QUEUE', req);
  console.log('get header', res.getHeaders());
  let bodyJSON = req.body;
  // console.log('bodyJSON', bodyJSON);
  let userRole = bodyJSON.userRole;
  let userId = bodyJSON.userId;
  let match;
  if (userRole === 'investor') {
    match = findMatch(userId, ideaQueue);
    if (match) {
      // should only do matching if we found a match
      makeMatchCredentials(userId, match, res);
    } else {
      // otherwise we generate a new session and send the credentials and put in queue
      getNewSessionCrendtials(userId, res);
      investorQueue.push(userId);
    }
  } else if (userRole === 'idea') {
    match = findMatch(userId, investorQueue);
    if (match) {
      // should only do matching if we found a match
      makeMatchCredentials(userId, match, res);
    } else {
      // otherwise we generate a new session and send the credentials and put in queue
      getNewSessionCrendtials(userId, userSessionDict, res);
      ideaQueue.push(userId);
    }
  }
});
// get everything in the server state
// PURELY TROUBLESHOOTING
router.get('/servertest', (req, res) => {
  console.log('userArray', userArray);
  console.log('ideaQueue', ideaQueue);
  console.log('investorQueue', investorQueue);
  console.log('previousMatches', previousMatches);
  console.log('userSessionDict', userSessionDict);

  res.set({
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.send({
    userArray: userArray,
    ideaQueue: ideaQueue,
    investorQueue: investorQueue,
    previousMatches: previousMatches,
    userSessionDict: userSessionDict
  });
});
router.get('/', (req, res) => {
  res.render('index', { title: 'Learning-OpenTok-Node' });
});

module.exports = router;

//---------------------------------------------------------------
//---------------------------------------------------------------
//---------------------------------------------------------------
//---------------------------------------------------------------
//---------------------------------------------------------------
//---------------------------------------------------------------
//---------------------------------------------------------------
//---------------------------------------------------------------
//---------------------------------------------------------------
// -------------------ProvIded Code Base--------------------------
//---------------------------------------------------------------
//---------------------------------------------------------------
//---------------------------------------------------------------
//---------------------------------------------------------------
//---------------------------------------------------------------
//---------------------------------------------------------------
//---------------------------------------------------------------
//---------------------------------------------------------------
//---------------------------------------------------------------
//---------------------------------------------------------------
//---------------------------------------------------------------
//---------------------------------------------------------------

// // returns the room name, given a session Id that was associated with it
// function findRoomFromSessionId(sessionId) {
//   return _.findKey(roomToSessionIdDictionary, function (value) { return value === sessionId; });
// }
// // IMPORTANT: roomToSessionIdDictionary is a variable that associates room names with unique
// // unique sesssion Ids. However, since this is stored in memory, restarting your server will
// // reset these values if you want to have a room-to-session association in your production
// // application you should consIder a more persistent storage
// var roomToSessionIdDictionary = {};
// /**
//  * GET /session redirects to /room/session
//  */
// router.get('/session', function (req, res) {
//   res.redirect('/room/session');
// });
// /**
//  * GET /room/:name
//  */
// router.get('/room/:name', function (req, res) {
//   var roomName = req.params.name;
//   var sessionId;
//   var token;
//   console.log('attempting to create a session associated with the room: ' + roomName);

//   // if the room name is associated with a session Id, fetch that
//   if (roomToSessionIdDictionary[roomName]) {
//     sessionId = roomToSessionIdDictionary[roomName];

//     // generate token
//     token = opentok.generateToken(sessionId);
//     res.setHeader('Content-Type', 'application/json');
//     res.send({
//       apiKey: apiKey,
//       sessionId: sessionId,
//       token: token
//     });
//   }
//   // if this is the first time the room is being accessed, create a new session Id
//   else {
//     opentok.createSession({ mediaMode: 'routed' }, function (err, session) {
//       if (err) {
//         console.log(err);
//         res.status(500).send({ error: 'createSession error:' + err });
//         return;
//       }

//       // now that the room name has a session associated wit it, store it in memory
//   // IMPORTANT: Because this is stored in memory, restarting your server will reset these values
//       // if you want to store a room-to-session association in your production application
//       // you should use a more persistent storage for them
//       roomToSessionIdDictionary[roomName] = session.sessionId;

//       // generate token
//       token = opentok.generateToken(session.sessionId);
//       res.setHeader('Content-Type', 'application/json');
//       res.send({
//         apiKey: apiKey,
//         sessionId: session.sessionId,
//         token: token
//       });
//     });
//   }
// });
// /**
//  * POST /archive/start
//  */
// router.post('/archive/start', function (req, res) {
//   var json = req.body;
//   var sessionId = json.sessionId;
//  opentok.startArchive(sessionId, { name: findRoomFromSessionId(sessionId) },function(err, archive) {
//     if (err) {
//       console.error('error in startArchive');
//       console.error(err);
//       res.status(500).send({ error: 'startArchive error:' + err });
//       return;
//     }
//     res.setHeader('Content-Type', 'application/json');
//     res.send(archive);
//   });
// });

// /**
//  * POST /archive/:archiveId/stop
//  */
// router.post('/archive/:archiveId/stop', function (req, res) {
//   var archiveId = req.params.archiveId;
//   console.log('attempting to stop archive: ' + archiveId);
//   opentok.stopArchive(archiveId, function (err, archive) {
//     if (err) {
//       console.error('error in stopArchive');
//       console.error(err);
//       res.status(500).send({ error: 'stopArchive error:' + err });
//       return;
//     }
//     res.setHeader('Content-Type', 'application/json');
//     res.send(archive);
//   });
// });

// /**
//  * GET /archive/:archiveId/view
//  */
// router.get('/archive/:archiveId/view', function (req, res) {
//   var archiveId = req.params.archiveId;
//   console.log('attempting to view archive: ' + archiveId);
//   opentok.getArchive(archiveId, function (err, archive) {
//     if (err) {
//       console.error('error in getArchive');
//       console.error(err);
//       res.status(500).send({ error: 'getArchive error:' + err });
//       return;
//     }

//     if (archive.status === 'available') {
//       res.redirect(archive.url);
//     } else {
//       res.render('view', { title: 'Archiving Pending' });
//     }
//   });
// });
// /**
//  * GET /archive/:archiveId
//  */
// router.get('/archive/:archiveId', function (req, res) {
//   var archiveId = req.params.archiveId;

//   // fetch archive
//   console.log('attempting to fetch archive: ' + archiveId);
//   opentok.getArchive(archiveId, function (err, archive) {
//     if (err) {
//       console.error('error in getArchive');
//       console.error(err);
//       res.status(500).send({ error: 'getArchive error:' + err });
//       return;
//     }

//     // extract as a JSON object
//     res.setHeader('Content-Type', 'application/json');
//     res.send(archive);
//   });
// });
// /**
//  * GET /archive
//  */
// router.get('/archive', function (req, res) {
//   var options = {};
//   if (req.query.count) {
//     options.count = req.query.count;
//   }
//   if (req.query.offset) {
//     options.offset = req.query.offset;
//   }

//   // list archives
//   console.log('attempting to list archives');
//   opentok.listArchives(options, function (err, archives) {
//     if (err) {
//       console.error('error in listArchives');
//       console.error(err);
//       res.status(500).send({ error: 'infoArchive error:' + err });
//       return;
//     }

//     // extract as a JSON object
//     res.setHeader('Content-Type', 'application/json');
//     res.send(archives);
//   });
// });
