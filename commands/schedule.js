const { MessageEmbed } = require("discord.js");

module.exports = {
    name: 'schedule',
    description: 'Find out todays games',
    execute(message, args) {
        console.log('Hello')
        const embed = new MessageEmbed()
            .setTitle('Predictions have opened!')
            .setColor(0xCAA368)
            .setDescription('100T vs C9')
            .setFooter('LCSBot');

        message.channel.send(embed).then(sentEmbed => {
            sentEmbed.react("🇦");
            sentEmbed.react("🇧");
        });
    },
};