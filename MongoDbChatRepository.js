var Q = require('q'),
    util = require('util'),
    ChatRepository = require('ChatRepository'),
    crypto = require("crypto");

module.exports = MongoChatRepositoryFactory

function makeMongodbResolver (deferred) {
    return function (error, value) {
        if (error) {
            deferred.reject(error);
        } else if (arguments.length > 1) {
            deffered.resolve(value);
        }
        else{
            deferred.resolve();
        }
    };
};

function MongoChatRepositoryFactory(db) {

    var rooms = db.collection('rooms');
    var users = db.collection('users');

    util.inherits(MongoChatRepository, ChatRepository);

    function MongoChatRepository(){
        this.joinRoom = function(room_name, username){
            var deferred = Q.defer();
            
            rooms.update({ name: room_name }, { $addToSet: { users: { username: username } } }, { upsert: true}, makeMongodbResolver(deferred));
            
            return deferred.promise.then(function ()  {
                var findDeferred = Q.defer();
                
                rooms.find({name: room_name}, makeMongodbResolver(findDeferred));
                
                return findDeferred.promise;
            }).then(function (docs){
                if(docs.length === 1){
                    return docs[0];
                }
                else{
                    throw new Error("An error occured while trying to join room '" + room_name + "'");
                }
            });
        };

        this.leaveRoom = function(room_name, username){
            var deferred = Q.defer();

            rooms.update({ name: room_name }, { $pop: { users: { username: username}}}, makeMongodbResolver(deferred));

            return deferred.promise;
        };

        this.addMessageToRoom = function(room_name, message){
            var deferred = Q.defer();

            rooms.update({name: room_name}, { $push: { messages: message}}, makeMongodbResolver(deferred));

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



