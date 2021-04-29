var mongoURL = 'mongodb://localhost:27017/lcsbot';
var MongoClient = require('mongodb').MongoClient;

module.exports = {
    name: 'join',
    description: 'Join the prediction challenge before it starts!',
    execute(message, args) {
        MongoClient.connect(mongoURL, { useUnifiedTopology: true }, function (err, db) {
            if (err) throw err;
            var dbo = db.db("lcsbot");
            dbo.collection("users").findOne({ name: `${message.author.username}`}, function(err, result){
                if (err) throw err;
                if (result == null){
                    var myObj = { name: `${message.author.username}`, win: 0, loss: 0 }
                    dbo.collection("users").insertOne(myObj, function (err, res) {
                        if (err) throw err;
                        console.log("1 Document Inserted");
                        message.channel.send(`${message.author.username} has joined the game!`);
                        db.close();
                    });
                } else {
                    message.channel.send(`You already joined the game!`);
                }
            });
        });
    },
};