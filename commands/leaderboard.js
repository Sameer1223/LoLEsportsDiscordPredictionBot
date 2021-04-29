const { MessageEmbed } = require("discord.js");
var mongoURL = 'mongodb://localhost:27017/lcsbot';
var MongoClient = require('mongodb').MongoClient;

module.exports = {
    name: 'leaderboard',
    description: 'Leaderboard of players participating in the prediction game.',
    execute(message, args) {
        var namesString = '';
        MongoClient.connect(mongoURL, { useUnifiedTopology: true }, function (err, db) {
            if (err) throw err;
            var dbo = db.db("lcsbot");
            dbo.collection("users").find({}).toArray(function(err, result) {
                if (err) throw err;

                result.sort(function(first, second){
                    if (second.win === first.win){
                        return second.loss - first.loss;
                    }
                    return second.win - first.win;
                });
                var positions = [];
                for (var i = 0; i < result.length; i++){
                    if (i !== 0 && result[i].win === result[i-1].win && result[i].loss === result[i-1].loss){
                        positions[i] = positions[i-1];
                    } else {
                        positions[i] = i + 1;
                    }
                }

                for (var i = 0; i < result.length; i++) {
                    namesString += '[' + (positions[i]).toString() + '] ' + result[i].name + ' - W: ' + result[i].win + ' L: ' + result[i].loss + '\n';
                }
                console.log(namesString);
                if (namesString === '') namesString = 'None';

                const embed = new MessageEmbed()
                    .setTitle('Leaderboard')
                    .setColor(0xCAA368)
                    .setDescription('Players by Predictions Score')
                    .addField('Players', namesString)
                    .setFooter('LCSBot');

                message.channel.send(embed);
                db.close();
            });
        });
    },
};