// require the discord.js module
const fs = require('fs');
const fetch = require('node-fetch');
const Discord = require('discord.js');
const { prefix, token, seriesCode, channel } = require('./config.json');
const { MessageEmbed } = require("discord.js");
var mongoURL = 'mongodb://localhost:27017/lcsbot';
var MongoClient = require('mongodb').MongoClient;
// create a new Discord client
const client = new Discord.Client();
client.commands = new Discord.Collection();

//Required data.
const channelID = channel;
//const monthToNum = {'Jan': '0', 'Feb': '1', 'Mar': '2', 'Apr':  '3', 'May': '4', 'Jun': '5', 'Jul': '6', 'Aug': '7', 'Sep': '8',  'Oct': '9', 'Nov': '10', 'Dec': '11'};
//const dayToNum = {'Sun': '0', 'Mon': '1', 'Tue': '2', 'Wed': '3', 'Thu': '4', 'Fri': '5', 'Sat': '6'};
const teamsToId = {'IMT': 112, 'FLY': 311, 'DIG': 384, 'C9': 1097, 'EG': 2876, 'TSM': 387, 'CLG': 389, 'TL': 390, 'GG': 1535, '100': 1537};

//Adding commands dynamically
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles){
    const command = require(`./commands/${file}`);
    client.commands.set(command.name, command);
}

//Initialization for Bot
client.once('ready', () => {
    console.log('Ready!');
});

//On message responses
client.on('message', message => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    if (!client.commands.has(commandName)) return;
    //Help commands
    if (commandName === 'help'){
        var commandKeys = Array.from(client.commands.keys());
        helpString = '';
        for (var i = 0; i < commandKeys.length; i++){
            helpString += commandKeys[i] + ': ' + '\n\t' + client.commands.get(commandKeys[i]).description + '\n\n';
        }

        const embed = new MessageEmbed()
            .setTitle('Help')
            .setColor(0xCAA368)
            .setDescription('Here are all the commands!')
            .addField('Commands', helpString)
            .setFooter('LCSBot');

        message.channel.send(embed);
    }

    //Executing command with respective names
    const command = client.commands.get(commandName);

    try {
        command.execute(message, args);
    } catch (error) {
        console.error(error);
        message.reply('There was an error executing that command!');
    }
});

var obj;
var game_dict = {};
fetch(`https://api.pandascore.co/series/${seriesCode}/tournaments?token=5CzatDWtUHFZ5o24gPL5Hp4rV-eBStuX0PdTwrP-PxL1gjGmO7c`)
    .then(res => res.json())
    .then(data => obj = data)
    .then(() => {
        for (var i = 0; i < obj.length; i++) {
            for (var j = 0; j < obj[i]['matches'].length; j++) {
                dateString = obj[i]['matches'][j]['scheduled_at'].slice(0, 19) + '.000Z';
                var dateTime = new Date(dateString);
                var ESTdate = new Date(dateTime.getTime() - 300 * 60000);
                game_dict[ESTdate.getTime()] = [obj[i]['matches'][j]['id'], obj[i]['matches'][j]['name']];
            }
        }
        const theData = JSON.stringify(game_dict, null, 4);

        fs.writeFile('gameSchedule.json', theData, (err) => {
            if (err) {
                throw err;
            }
            console.log('JSON data saved');
        });
    })
    .catch((err) => {
        console.log('Error: ', err);
    });

fs.readFile('gameSchedule.json', 'utf-8', (err, data) => {
    if (err) {
        throw err;
    }

    const dict = JSON.parse(data.toString());
    gameAnnouncement(dict);
    predictionScores(dict);
})

client.on("messageReactionAdd", function(messageReaction, user){
    var now = Date.now() - 300 * 60 * 1000;
    var gameTime = getGameTimeFromGame(messageReaction.message.embeds[0].description);
    if (now < gameTime && now > gameTime - 60 * 60000) {
        MongoClient.connect(mongoURL, { useUnifiedTopology: true }, function (err, db) {
            if (err) throw err;
            var dbo = db.db("lcsbot");
            var gameId = getGameIdFromGame(messageReaction.message.embeds[0].description);
            var myQuery = { gameId: gameId };
            dbo.collection("predictions").find({ "gameId": gameId, "teamAPredictions": { "$in": [user.username] } }).count().then(function(teamA){
                dbo.collection("predictions").find({ "gameId": gameId, "teamBPredictions": { "$in": [user.username] } }).count().then(function (teamB) {
                    dbo.collection("predictions").find({ "gameId": gameId, "tempHold": { "$in": [user.username] } }).count().then(function(tempHold){
                        if (user.username !== 'LCSBot' && teamA == 0 && teamB == 0) {
                            if (messageReaction.emoji.name === '🇦') {
                                var newVal = { $push: { teamAPredictions: user.username } }
                                dbo.collection("predictions").updateOne(myQuery, newVal, function (err, res) {
                                    if (err) throw err;
                                    console.log("1 Document updated");
                                    db.close();
                                });
                            } else if (messageReaction.emoji.name === '🇧') {
                                var newVal = { $push: { teamBPredictions: user.username } }
                                dbo.collection("predictions").updateOne(myQuery, newVal, function (err, res) {
                                    if (err) throw err;
                                    console.log("1 Document updated");
                                    db.close();
                                });
                            }
                        } else if (user.username != 'LCSBot') {
                            if (tempHold == 0) {
                                if ((messageReaction.emoji.name === '🇦' && teamB != 0) || (messageReaction.emoji.name === '🇧' && teamA != 0)) {
                                    var newVal = { $push: { tempHold: user.username } }
                                    dbo.collection("predictions").updateOne(myQuery, newVal, function (err, res) {
                                        if (err) throw err;
                                        console.log("1 Document updated");
                                        db.close();
                                    });
                                }
                            }
                        }
                    });
                });
            });
        });
    }
});

client.on("messageReactionRemove", function (messageReaction, user) {
    var now = Date.now() - 300 * 60 * 1000;
    var gameTime = getGameTimeFromGame(messageReaction.message.embeds[0].description);
    if (now < gameTime && now > gameTime - 60 * 60000){
        MongoClient.connect(mongoURL, { useUnifiedTopology: true }, function (err, db) {
            if (err) throw err;
            var dbo = db.db("lcsbot");
            var gameId = getGameIdFromGame(messageReaction.message.embeds[0].description);
            var myQuery = { gameId: gameId };
            console.log(gameId);
            if (messageReaction.emoji.name === '🇦') {
                var newVal = { $pull: { teamAPredictions: user.username } }
                dbo.collection("predictions").updateOne(myQuery, newVal, function (err, res) {
                    if (err) throw err;
                    console.log("1 Document updated");
                });
                dbo.collection("predictions").find({ "gameId": gameId, "tempHold": { "$in": [user.username] } }).count().then(function (tempHold) {
                    if (tempHold != 0) {
                        var newVal = { $pull: { tempHold: user.username } }
                        dbo.collection("predictions").updateOne(myQuery, newVal, function (err, res) {
                            if (err) throw err;
                            console.log("1 Document updated");
                        });
                        dbo.collection("predictions").find({ "gameId": gameId, "teamBPredictions": { "$in": [user.username] } }).count().then(function (teamB) {
                            if (teamB == 0) {
                                var newVal = { $push: { teamBPredictions: user.username } }
                                dbo.collection("predictions").updateOne(myQuery, newVal, function (err, res) {
                                    if (err) throw err;
                                    console.log("1 Document updated");
                                    db.close();
                                });
                            }
                        });
                    }
                });
            } else if (messageReaction.emoji.name === '🇧') {
                var newVal = { $pull: { teamBPredictions: user.username } }
                dbo.collection("predictions").updateOne(myQuery, newVal, function (err, res) {
                    if (err) throw err;
                    console.log("1 Document updated");
                });
                dbo.collection("predictions").find({ "gameId": gameId, "tempHold": { "$in": [user.username] } }).count().then(function (tempHold) {
                    if (tempHold != 0) {
                        var newVal = { $pull: { tempHold: user.username } }
                        dbo.collection("predictions").updateOne(myQuery, newVal, function (err, res) {
                            if (err) throw err;
                            console.log("1 Document updated");
                        });
                        dbo.collection("predictions").find({ "gameId": gameId, "teamAPredictions": { "$in": [user.username] } }).count().then(function (teamA) {
                            if (teamA == 0) {
                                var newVal = { $push: { teamAPredictions: user.username } }
                                dbo.collection("predictions").updateOne(myQuery, newVal, function (err, res) {
                                    if (err) throw err;
                                    console.log("1 Document updated");
                                    db.close();
                                });
                            }
                        });
                    }
                });
            }
        });
    }
});

client.login(token);


function gameAnnouncement(dict) {
    /*
    for (var key in dict) {
        var diff = Date.now() - 300 * 60 * 1000;
        var time = key - diff - 60 * 60 * 1000;
        if (key > diff && time > 0) {
            console.log("Time to: ", time);
            console.log("Time now: ", diff);
            setTimeout(function () {
                sendGameMessage(dict);
            }, time);
        }
    }
    */
    var key = 1613847600000;
    setTimeout(function () {
        sendGameMessage(dict);
    }, 3000);

}

function sendGameMessage(dict){
    /*
    var now = Date.now() - 300 * 60000;
    console.log("Announcement Now: ", now);
    var epochString = now.toString();
    var timeKey = (parseInt(epochString.slice(0, 8) + '00000') + 60 * 60 * 1000).toString();
    console.log(timeKey);
    */
    var timeKey = 1613847600000;

    const embed = new MessageEmbed()
        .setTitle('Predictions have opened!')
        .setColor(0xCAA368)
        .setDescription(dict[timeKey][1])
        .setFooter('LCSBot');
    client.channels.cache.get(channelID).send(embed).then(sentEmbed => {
        sentEmbed.react("🇦");
        sentEmbed.react("🇧");
    });

    MongoClient.connect(mongoURL, { useUnifiedTopology: true }, function (err, db) {
        if (err) throw err;
        var dbo = db.db("lcsbot");
        var name = dict[timeKey][1];
        var teamsList = name.split(" ");
        var myObj = { gameId: (dict[timeKey][0]), team1ID: teamsToId[teamsList[teamsList.length - 3]], team2ID: teamsToId[teamsList[teamsList.length - 1]], teamAPredictions: [], teamBPredictions: [], tempHold: [] }
        dbo.collection("predictions").insertOne(myObj, function (err, result) {
            if (err) throw err;
            console.log("Game Document Added");
            db.close();
        });
    });
}

function predictionScores(dict) {
    for (var key in dict) {
        var diff = Date.now() - 300 * 60 * 1000;
        var time = key - diff + 90 * 60 * 1000;
        if (key > diff && time > 0){
            setTimeout(function(){
                logScores(dict);
            }, time);
        }
    }
}

function logScores(dict){
    var now = Date.now() - 300 * 60000;
    console.log("Announcement Now: ", now);
    var epochString = now.toString();
    var timeKey = (parseInt(epochString.slice(0, 8) + '00000') + 60 * 60 * 1000).toString();
    console.log(timeKey);

    fetch(`https://api.pandascore.co/series/${seriesCode}/tournaments?token=5CzatDWtUHFZ5o24gPL5Hp4rV-eBStuX0PdTwrP-PxL1gjGmO7c`)
        .then(res => res.json())
        .then(data => obj = data)
        .then(() => {
            for (var i = 0; i < obj.length; i++) {
                for (var j = 0; j < obj[i]['matches'].length; j++) {
                    var gameCode = obj[i]['matches'][j]['id'];
                    if (gameCode === getGameIdFromGame(dict[timeKey][1])) {
                        var winner = obj[i]['matches'][j]['winner_id'];
                        MongoClient.connect(mongoURL, { useUnifiedTopology: true }, function (err, db) {
                            if (err) throw err;
                            var dbo = db.db("lcsbot");
                            dbo.collection("predictions").findOne({ "gameId": dict[timeKey][0] }, function (err, result) {
                                if (err) throw err;
                                if (result != null){
                                    var winners = [];
                                    var losers = [];
                                    if (result.team1ID === winner) {
                                        winners = result.teamAPredictions;
                                        losers = result.teamBPredictions;
                                    } else {
                                        winners = result.teamBPredictions;
                                        losers = result.teamAPredictions;
                                    }
                                    dbo.collection("users").find({}).toArray(function (err, result) {
                                        if (err) throw err;

                                        for (var i = 0; i < result.length; i++){
                                            console.log(result[i]);
                                            if (winners.includes(result[i].name)){
                                                var wins = result[i].win;
                                                var myQuery = { name: result[i].name };
                                                var newVal = { $set: { win: wins + 1 } };
                                                dbo.collection("users").updateOne(myQuery, newVal, function (err, res) {
                                                    if (err) throw err;
                                                    console.log("Win added for user");
                                                });
                                            } else if (losers.includes(result[i].name)){
                                                var losses = result[i].loss;
                                                var myQuery = { name: result[i].name };
                                                var newVal = { $set: { loss: losses + 1 } };
                                                dbo.collection("users").updateOne(myQuery, newVal, function (err, res) {
                                                    if (err) throw err;
                                                    console.log("Loss added for user");
                                                });
                                            }
                                        }
                                    });
                                }
                                console.log(winners, losers);
                            });
                        });
                    }
                }
            }
        })
        .catch((err) => {
            console.log('Error: ', err);
        });
}

function getGameIdFromGame(gameString){
    var data = fs.readFileSync('gameSchedule.json', 'utf-8');
    const dict = JSON.parse(data.toString());
    for (var key in dict){
        if (dict[key][1] === gameString){
            return dict[key][0];
        }
    }
}

function getGameTimeFromGame(gameString) {
    var data = fs.readFileSync('gameSchedule.json', 'utf-8');
    const dict = JSON.parse(data.toString());
    for (var key in dict) {
        if (dict[key][1] === gameString) {
            return key;
        }
    }
}
/*
Predictions:
0) Convert times to Data objects
1) Convert times to EST
2) Make cron tasks for code to run an hour before the games
3) MongoDB write predictions command data with select teams
4) Lock time, and have an active game that you can make predictions for that changes on the scheduled time
5) Schedule cron task for after 1 hour
6) Call pandascore api and get winner
7) Get id of winner if teamA then loop through teamApredictions, same for teamB
8) For each player find and update wins by 1, for each player in other list update losses by 1
9) Sort leaderboard and display
10) False part is necessary
11) Fix teams issue
12) Change channel Id and invite to Pac
13) Fix repeating cronjobs
14) Fix incorrect gameid
15) Fix null data being returned
16) Fix updating of data
*/