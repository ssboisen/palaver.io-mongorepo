var Q = require('q')
  , util = require('util')
  , palaver = require('palaver.io')
  , mongojs = require('mongojs');

module.exports = MongoChatRepositoryFactory

function makeMongodbResolver (deferred) {
    return function (error, value) {
        if (error) {
            deferred.reject(error);
        } else if (arguments.length > 1) {
            deferred.resolve(value);
        }
        else{
            deferred.resolve();
        }
    };
};

function MongoChatRepositoryFactory(mongoUrl) {

    var db = mongojs(process.env.MONGOURL || mongoUrl || 'palaver');
    var rooms = db.collection('rooms');
    var users = db.collection('users');

    util.inherits(MongoChatRepository, palaver.AbstractChatRepository);

    function MongoChatRepository(){
        this.joinRoom = function(roomName, username){
            var deferred = Q.defer();

            rooms.update({ name: roomName }, { $addToSet: { users: { username: username } } }, { upsert: true}, makeMongodbResolver(deferred));
            
            return deferred.promise.then(function ()  {
                var findDeferred = Q.defer();
                
                rooms.find({name: roomName}, makeMongodbResolver(findDeferred));
                
                return findDeferred.promise;
            }).then(function (docs){
                if(docs.length === 1){
                    return docs[0];
                }
                else{
                    throw new Error("An error occured while trying to join room '" + roomName + "'");
                }
            });
        };

        this.leaveRoom = function(roomName, username){
            var deferred = Q.defer();

            rooms.update({ name: roomName }, { $pop: { users: { username: username}}}, makeMongodbResolver(deferred));

            return deferred.promise;
        };

        this.addMessageToRoom = function(roomName, message){
            var deferred = Q.defer();

            rooms.update({name: roomName}, { $push: { messages: message}}, makeMongodbResolver(deferred));

            return deferred.promise;
        };

        this.roomsForUser = function(username){
            var deferred = Q.defer();

            rooms.find({ "users.username" : username }, makeMongodbResolver(deferred));

            return deferred.promise;
        };

        this.findUser = function(username){
            var deferred = Q.defer();

            users.find({ username: username }, makeMongodbResolver(deferred));

            return deferred.promise.then(function(docs){
                if(docs.length === 1){
                    return docs[0];
                }

                return null;
            });
        };
    };

    return MongoChatRepository;
};



