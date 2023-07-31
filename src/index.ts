import express from 'express';
import { AmethystClient } from 'amethystjs';
import { GuildQueue, Player } from 'discord-player';
import { ButtonBuilder, ButtonStyle, EmbedBuilder, Partials } from 'discord.js';
import { config } from 'dotenv';
import { boolEmojis, checkForDuplicates, checkForEnv, getLoopState, getRandomStation, getStationByUrl, getTester, row, setLoopState } from './utils/functions';
import { TesterButtons } from './typings/tester';
import { queuesUsers } from './utils/maps';
import { Langs } from './langs/Manager';

config();

const duplicated = checkForDuplicates();
if (duplicated.length > 0) {
    console.log(duplicated);
    throw new Error('Some musics are duplicated');
}
checkForEnv();

export const client = new AmethystClient(
    {
        intents: ['Guilds', 'GuildVoiceStates', 'GuildMessages', 'DirectMessages'],
        partials: [Partials.Channel, Partials.Message]
    },
    {
        // Folders
        commandsFolder: './dist/commands',
        eventsFolder: './dist/events',
        preconditionsFolder: './dist/preconditions',
        autocompleteListenersFolder: './dist/autocompletes',
        buttonsFolder: './dist/buttons',
        // Booleans
        debug: true,
        strictPrefix: false,
        botNameWorksAsPrefix: true,
        mentionWorksAsPrefix: false,
        // Client data
        token: process.env.beta_token ? process.env.beta_token : process.env.token,
        prefix: process.env.botPrefix ?? 'lucy!',
        botName: 'Lucy Radio'
    }
);

client.player = new Player(client, {
    ytdlOptions: {
        filter: 'audioonly',
        quality: 'highestaudio',
        highWaterMark: 1 << 30
    }
});
client.player.events.on('emptyQueue', async (queue: GuildQueue) => {
    if (!getLoopState(queue.guild.id)) return;

    const track = await client.player
        .search(getRandomStation().url, {
            requestedBy: queuesUsers.get(queue.guild.id) ?? client.user
        })
        .catch(() => {});

    if (!track || track.tracks.length === 0) return;
    queue.node.play(track.tracks[0]);
});
client.player.events.on('disconnect', (queue: GuildQueue) => {
    if (!getLoopState(queue.guild.id)) return;
    setLoopState(queue.guild.id, false);

    queue.tracks.clear();
    queuesUsers.delete(queue.guild.id);
});
client.player.events.on('playerFinish', (queue, track) => {
    if (getTester(track.requestedBy.id)) {
        const data = getTester(track.requestedBy.id);
        if (data.when === 'everytime' || data.when === 'songend') {
            const station = getStationByUrl(track.url);
            if (station && !station.feedbacks.find((x) => x.user_id === track.requestedBy.id)) {
                track.requestedBy
                    .send({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle(`${station.emoji} ${station.name}`)
                                .setURL(station.url)
                                .setImage(track.thumbnail ?? undefined)
                                .setDescription(
                                    `Do you want to send your feedback about [${station.emoji} ${station.name}](${station.url}) ?`
                                )
                                .setColor('#F4554B')
                        ],
                        components: [
                            row(
                                new ButtonBuilder({
                                    label: 'Send feedback',
                                    emoji: boolEmojis(true),
                                    customId: TesterButtons.SendFeedback,
                                    style: ButtonStyle.Success
                                })
                            )
                        ]
                    })
                    .catch(() => {});
            }
        }
    }
});

const app = express();
app.set('view engine', 'ejs');

// Route untuk web view
app.get('/aboutme', async (req, res) => {
    try {
        const station = getRandomStation(); // Ganti ini dengan logika untuk mendapatkan stasiun musik acak
        const track = await client.player.search(station.url); // Ganti ini dengan logika untuk mendapatkan lagu acak dari stasiun

        res.render('aboutme', { station, track });
    } catch (error) {
        res.status(500).send('Error');
    }
});

client.start({});

declare module 'discord.js' {
    interface Client {
        player: Player;
        langs: Langs;
    }
}
declare module 'amethystjs' {
    interface AmethystClient {
        player: Player;
    }
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Web view is running at http://localhost:${port}/aboutme`);
});