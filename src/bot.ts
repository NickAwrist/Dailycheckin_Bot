import {Client, GatewayIntentBits, Interaction} from 'discord.js';
import dotenv from 'dotenv';
import cron from 'node-cron';
import logger from "./utils/logger";

import {checkinAllUsers} from './hoyolab/checkinAllUsers';
import {connectToDatabase} from "./database/dbConnection";
import {handleButtonInteraction} from "./interactions/buttons";
import {handleCommands, registerCommands} from './interactions/commands';
import {handleModalSubmit} from "./interactions/modalSubmit";
import {getTotalUsers} from "./database/userRepository";
import {initMetrics, updateBotHeartbeat, updateTotalGuilds, updateTotalUsers} from "./utils/metrics";
import {startMetricsServer} from "./utils/metricsServer";
import express from 'express';


// Create client object and list intents
const client = new Client({ intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.DirectMessages
]});

dotenv.config();

// Bot environment variables
export const config = {
    TOKEN: process.env.TOKEN || '',
    CLIENT_ID: process.env.CLIENT_ID || '',
    BOT_ADMIN_ID: process.env.BOT_ADMIN_ID || '',
    MONGO_URI: process.env.MONGO_URI || '',
    DATABASE_NAME: process.env.DATABASE_NAME || '',
    METRICS_PORT: process.env.METRICS_PORT || 3001,
}

if(!config.TOKEN || !config.CLIENT_ID || !config.BOT_ADMIN_ID || !config.MONGO_URI || !config.DATABASE_NAME || !config.METRICS_PORT){
    logger.error('Missing environment variables');
    process.exit(1);
}

const expApp = express();
expApp.get('/', (req, res) => {
    res.status(200).send('I am alive dont kill me')
})

expApp.listen(8080, () => {
    logger.info('Express server is running on port 8080');
})


// When ready
client.on('ready', async () => {
    // Connect to MongoDB
    logger.info('Initializing database connection...');
    await connectToDatabase(config.MONGO_URI, config.DATABASE_NAME);
    logger.info('Database connection established.');

    // Register slash commands
    logger.info('Registering slash commands...');
    await registerCommands(config.CLIENT_ID, config.TOKEN);
    logger.info('Slash commands registered.');

    handleInteractions(client);

    startMetricsServer(config.METRICS_PORT as number);
    await initMetrics();

    await updateStatus();

    // Update bot status periodically
    setInterval(async () => {
        await updateStatus();
    }, 300000);

    // Update bot heartbeat periodically
    setInterval(() => {
        updateBotHeartbeat();
    }, 60000);

    // Schedule Daily checkin task
    logger.info('Scheduling daily check-in task...');
    await scheduleDailyTask(12, 7);
    logger.info('Daily check-in task scheduled.');
});

async function updateStatus() {
    const guildCount = client.guilds.cache.size;
    const userCount = await getTotalUsers();

    await updateTotalUsers(userCount);
    await updateTotalGuilds(guildCount);

    // Set the bot's status
    client.user?.setPresence({
        activities: [
            { name: `${guildCount} servers | ${userCount} users`, type: 3 },
        ],
        status: 'online',
    });

    logger.info(`Updated status: ${guildCount} servers, ${userCount} users`);
}


// Timing functions

// Function to schedule a task at a specific time every day
async function scheduleDailyTask(hour: number, minute: number) {
    const time = `${minute} ${hour} * * *`;

    cron.schedule(time, async () => {
        logger.info(`Task running at ${hour}:${minute}`);
        await checkinAllUsers();
    }, {
        scheduled: true,
        timezone: "America/New_York" 
    });
}

client.login(config.TOKEN).then(() => {
   logger.info(`Logged in as ${client.user?.tag}!`);
});



// Interaction Handling
export const handleInteractions = (client: Client): void => {
    client.on('interactionCreate', async (interaction: Interaction) => {
        if (interaction.isButton()){
            await handleButtonInteraction(interaction);
        }else if(interaction.isCommand()){
            await handleCommands(interaction);
        }else if(interaction.isModalSubmit()){
            await handleModalSubmit(interaction);
        }
    });
}