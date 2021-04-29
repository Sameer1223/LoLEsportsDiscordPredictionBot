const fetch = require('node-fetch');

module.exports = {
    name: 'teams',
    description: 'LCS Teams and Players',
    execute(message, args) {
        var roles = ['top', 'jun', 'mid', 'adc', 'sup'];
        var msg = '\`\`\`python\n';
        fetch('https://api.pandascore.co/tournaments/5459/teams?token=5CzatDWtUHFZ5o24gPL5Hp4rV-eBStuX0PdTwrP-PxL1gjGmO7c')
            .then((response) => {
                return response.json()
            })
            .then(function (data) {
                for (var i = 0; i < data.length; i++) {
                    msg += `====================\n${data[i]['name']}\n====================\n`;
                    for (var j = 0; j < roles.length; j++){
                        for (var k = 0; k < data[i]['players'].length; k++){
                            if (data[i]['players'][k]['role'] === roles[j]){
                                var role = roles[j].charAt(0).toUpperCase() + roles[j].slice(1);
                                msg += role + ': ' + data[i]['players'][k]['name'] + '\n';
                            }
                        }
                    }
                }
                msg += '\`\`\`';
                message.channel.send(msg);
            })
            .catch((err) => {
                console.log('Fetch Error :-S', err)
            })
    },
};